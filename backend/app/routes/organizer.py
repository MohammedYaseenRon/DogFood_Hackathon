from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role
from app.database import get_db
from app.models import (
    Event,
    JudgeAssignment,
    Project,
    Role,
    RubricCriterion,
    Score,
    Team,
    TeamMember,
    User,
)
from app.services.audit import log_action
from app.services.event_state import can_submit
from app.services.events import event_counts, iso, resolve_event, serialize_event_ref

router = APIRouter(prefix="/api/organizer", tags=["organizer"])


class RubricUpdate(BaseModel):
    criteria: list[dict[str, float | str]] = Field(
        description="List of {name, weight} objects"
    )


def _event_project_ids(db: Session, event: Event) -> list[str]:
    return [
        row.id
        for row in db.query(Project.id).join(Project.team).filter(Team.event_id == event.id)
    ]


@router.get("/events")
def organizer_events(request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    events = db.query(Event).order_by(Event.submissions_close.desc()).all()
    return {
        "events": [
            {
                **serialize_event_ref(event),
                "published": event.published,
                "counts": event_counts(db, event),
            }
            for event in events
        ]
    }


@router.get("/events/{slug}/submissions")
def event_submissions(slug: str, request: Request, db: Session = Depends(get_db)):
    """Every team and its project (drafts included) for one event."""
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    event = resolve_event(db, slug)
    teams = (
        db.query(Team)
        .options(joinedload(Team.members).joinedload(TeamMember.user), joinedload(Team.projects))
        .filter(Team.event_id == event.id)
        .order_by(Team.name.asc())
        .all()
    )
    rows = []
    for team in teams:
        project = team.projects[0] if team.projects else None
        rows.append(
            {
                "teamId": team.id,
                "teamName": team.name,
                "members": [
                    {"name": m.user.name or m.user.email, "email": m.user.email, "role": m.role.value}
                    for m in team.members
                ],
                "project": {
                    "id": project.fixture_id,
                    "title": project.title,
                    "status": project.status.value,
                    "trackName": project.track.name if project.track else None,
                    "submittedAt": iso(project.submitted_at),
                    "updatedAt": iso(project.updated_at),
                }
                if project
                else None,
            }
        )
    return {
        "event": serialize_event_ref(event),
        "counts": event_counts(db, event),
        "teams": rows,
    }


@router.get("/stats")
def organizer_stats(request: Request, event: str | None = None, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    target = resolve_event(db, event)
    project_ids = _event_project_ids(db, target)

    assignments = (
        db.query(JudgeAssignment).filter(JudgeAssignment.project_id.in_(project_ids)).all()
        if project_ids
        else []
    )
    scores = (
        db.query(Score).filter(Score.project_id.in_(project_ids)).all() if project_ids else []
    )
    scored_pairs = {(score.judge_id, score.project_id) for score in scores}

    judges = db.query(User).filter(User.role == Role.JUDGE).order_by(User.name.asc()).all()
    judge_progress = []
    for judge in judges:
        assigned = [a for a in assignments if a.judge_id == judge.id]
        completed = sum(1 for a in assigned if (judge.id, a.project_id) in scored_pairs)
        total = len(assigned)
        judge_progress.append(
            {
                "id": judge.fixture_id or judge.id,
                "name": judge.name or judge.email,
                "email": judge.email,
                "assigned": total,
                "completed": completed,
                "remaining": max(total - completed, 0),
                "percent": round((completed / total) * 100, 1) if total else 0,
            }
        )

    total_assignments = len(assignments)
    total_scored = sum(item["completed"] for item in judge_progress)
    active = [item for item in judge_progress if item["assigned"]]

    return {
        "totalProjects": len(project_ids),
        "totalJudges": len(active),
        "totalAssignments": total_assignments,
        "totalScores": total_scored,
        "remainingAssignments": max(total_assignments - total_scored, 0),
        "completionPercent": round((total_scored / total_assignments) * 100, 1)
        if total_assignments
        else 0.0,
        "judgesComplete": sum(1 for item in active if item["completed"] >= item["assigned"]),
        "judgesBehind": sum(1 for item in active if item["percent"] < 50),
        "averageJudgePercent": round(sum(item["percent"] for item in active) / len(active), 1)
        if active
        else 0,
        "event": {
            **serialize_event_ref(target),
            "submissionsOpen": can_submit(target),
            "counts": event_counts(db, target),
        },
        "judgeProgress": active,
    }


@router.get("/rubric")
def get_rubric(request: Request, event: str | None = None, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    target = resolve_event(db, event)
    rubric = (
        db.query(RubricCriterion)
        .filter(RubricCriterion.event_id == target.id)
        .order_by(RubricCriterion.name.asc())
        .all()
    )
    return {"criteria": [{"name": item.name, "weight": item.weight} for item in rubric]}


@router.patch("/rubric")
def update_rubric(
    body: RubricUpdate,
    request: Request,
    event: str | None = None,
    db: Session = Depends(get_db),
):
    user = require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    target = resolve_event(db, event)

    for item in body.criteria:
        name = str(item["name"]).strip()
        weight = float(item["weight"])
        if not name:
            raise HTTPException(status_code=400, detail="Criterion name is required")
        if weight <= 0:
            raise HTTPException(status_code=400, detail=f"Weight for {name} must be positive")

        row = (
            db.query(RubricCriterion)
            .filter(RubricCriterion.event_id == target.id, RubricCriterion.name == name)
            .first()
        )
        if row:
            row.weight = weight
        else:
            db.add(RubricCriterion(event_id=target.id, name=name, weight=weight))

    log_action(
        db,
        actor_id=user.id,
        action="rubric.updated",
        resource_type="event",
        resource_id=target.fixture_id,
        metadata={"criteria": body.criteria},
    )
    db.commit()
    return get_rubric(request, target.slug, db)
