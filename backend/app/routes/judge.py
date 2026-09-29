from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role, resolve_judge_alias
from app.database import get_db
from app.lib.scoring import validate_criteria, weighted_total
from app.models import EventJudge, Project, Role, RubricCriterion, Score, Team
from app.services.audit import log_action
from app.services.event_state import scoring_block_reason
from app.services.events import iso, resolve_event, serialize_event_ref
from app.services.judging import (
    event_rubric,
    judge_can_access_project,
    serialize_criterion,
    visible_assignments,
)

router = APIRouter()


class ScoreSubmit(BaseModel):
    project_id: str = Field(description="Fixture project id, e.g. prj_01")
    criteria: dict[str, float]
    comment: str = Field(default="", max_length=4000)


class RubricCache:
    """Rubrics keyed by event so projects from different events score correctly."""

    def __init__(self, db: Session):
        self.db = db
        self._cache: dict[str, list[RubricCriterion]] = {}

    def for_project(self, project: Project) -> list[RubricCriterion]:
        event_id = project.team.event_id
        if event_id not in self._cache:
            self._cache[event_id] = event_rubric(self.db, event_id)
        return self._cache[event_id]


def resolve_project(db: Session, project_id: str) -> Project | None:
    return (
        db.query(Project)
        .options(joinedload(Project.team).joinedload(Team.event), joinedload(Project.track))
        .filter((Project.fixture_id == project_id) | (Project.id == project_id))
        .first()
    )


def serialize_score(score: Score, rubric: list[RubricCriterion]) -> dict:
    criteria = score.criteria or {}
    return {
        "projectId": score.project.fixture_id or score.project_id,
        "title": score.project.title,
        "criteria": criteria,
        "comment": score.comment,
        "weightedTotal": weighted_total(criteria, rubric),
        "updatedAt": iso(score.updated_at),
    }


def _seats(db: Session, user_id: str) -> list[EventJudge]:
    return (
        db.query(EventJudge)
        .options(joinedload(EventJudge.tracks), joinedload(EventJudge.event))
        .filter(EventJudge.user_id == user_id)
        .all()
    )


@router.get("/api/judge/events")
def judge_events(request: Request, db: Session = Depends(get_db)):
    """Panels the caller sits on, with their scope, rubric and scoring window."""
    user = require_role(db, request, [Role.JUDGE])
    assignments = visible_assignments(db, user)
    scored = {s.project_id for s in db.query(Score.project_id).filter(Score.judge_id == user.id)}

    events = []
    for seat in _seats(db, user.id):
        event = seat.event
        mine = [a for a in assignments if a.project.team.event_id == event.id]
        track_names = sorted(t.name for t in event.tracks if t.id in seat.track_ids)
        reason = scoring_block_reason(event)
        events.append(
            {
                **serialize_event_ref(event),
                "tracks": track_names,
                "allTracks": not seat.track_ids,
                "rubric": [serialize_criterion(c) for c in event_rubric(db, event.id)],
                "scoringOpen": reason is None,
                "scoringBlockReason": reason,
                "judgingEnds": iso(event.judging_ends),
                "assigned": len(mine),
                "completed": sum(1 for a in mine if a.project_id in scored),
            }
        )
    events.sort(key=lambda e: (not e["scoringOpen"], e["name"]))
    return events


@router.get("/api/judge/rubric")
def judge_rubric(request: Request, event: str | None = None, db: Session = Depends(get_db)):
    user = require_role(db, request, [Role.JUDGE])
    seats = _seats(db, user.id)
    if event:
        target = resolve_event(db, event)
        if not any(seat.event_id == target.id for seat in seats):
            raise HTTPException(status_code=403, detail="You are not on this event's judge panel")
        event_id = target.id
    elif seats:
        assigned = visible_assignments(db, user)
        event_id = assigned[0].project.team.event_id if assigned else seats[0].event_id
    else:
        return []
    return [serialize_criterion(item) for item in event_rubric(db, event_id)]


@router.get("/api/judge/assignments")
def judge_assignments(request: Request, event: str | None = None, db: Session = Depends(get_db)):
    user = require_role(db, request, [Role.JUDGE])
    event_id = resolve_event(db, event).id if event else None
    rubrics = RubricCache(db)
    assignments = visible_assignments(db, user, event_id)
    scores = {
        score.project_id: score
        for score in db.query(Score).filter(Score.judge_id == user.id).all()
    }

    result = []
    for assignment in assignments:
        project = assignment.project
        score = scores.get(project.id)
        entry = {
            "projectId": project.fixture_id or project.id,
            "title": project.title,
            "tagline": project.tagline,
            "summary": project.summary,
            "trackName": project.track.name,
            "eventSlug": project.team.event.slug or project.team.event.fixture_id,
            "repoUrl": project.repo_url or None,
            "liveUrl": project.live_url,
            "videoUrl": project.video_url or project.demo_url,
            "batch": assignment.batch,
            "scored": score is not None,
        }
        if score:
            criteria = score.criteria or {}
            entry["criteria"] = criteria
            entry["comment"] = score.comment
            entry["weightedTotal"] = weighted_total(criteria, rubrics.for_project(project))
        result.append(entry)

    result.sort(key=lambda e: (e["scored"], e["trackName"], e["title"]))
    return result


@router.get("/api/judge/scores")
def judge_scores(
    request: Request,
    judge: str | None = None,
    db: Session = Depends(get_db),
):
    """The caller's own scores. Naming any other judge is refused: there is no
    code path that returns a peer's scores to a judge."""
    user = require_role(db, request, [Role.JUDGE])

    if judge:
        target = resolve_judge_alias(db, judge)
        if not target:
            raise HTTPException(status_code=404, detail="Judge not found")
        if target.id != user.id:
            raise HTTPException(status_code=403, detail="Cannot view another judge's scores")

    rubrics = RubricCache(db)
    visible = {a.project_id for a in visible_assignments(db, user)}
    scores = (
        db.query(Score)
        .options(joinedload(Score.project).joinedload(Project.team))
        .filter(Score.judge_id == user.id)
        .all()
    )
    # A score on a project the judge has since been scoped away from stays in
    # the database for the organizer, but the judge no longer sees it.
    return [
        serialize_score(score, rubrics.for_project(score.project))
        for score in scores
        if score.project_id in visible
    ]


@router.post("/api/judge/scores")
def submit_score(
    body: ScoreSubmit,
    request: Request,
    db: Session = Depends(get_db),
):
    user = require_role(db, request, [Role.JUDGE])
    project = resolve_project(db, body.project_id)
    # Unknown and not-yours look identical, so the endpoint can't be used to probe.
    if not project or not judge_can_access_project(db, user, project):
        raise HTTPException(status_code=403, detail="Not assigned to this project")

    event = project.team.event
    reason = scoring_block_reason(event)
    if reason:
        raise HTTPException(status_code=409, detail=reason)

    rubric = event_rubric(db, event.id)
    try:
        validate_criteria(body.criteria, rubric)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    criteria = {name: int(value) for name, value in body.criteria.items()}

    score = (
        db.query(Score)
        .filter(Score.judge_id == user.id, Score.project_id == project.id)
        .first()
    )
    action = "score.updated" if score else "score.submitted"
    if score:
        score.criteria = criteria
        score.comment = body.comment.strip()
    else:
        score = Score(
            judge_id=user.id,
            project_id=project.id,
            criteria=criteria,
            comment=body.comment.strip(),
        )
        db.add(score)

    log_action(
        db,
        actor_id=user.id,
        action=action,
        resource_type="project",
        resource_id=project.fixture_id,
        metadata={"event": event.fixture_id, "weightedTotal": weighted_total(criteria, rubric)},
    )
    db.commit()
    db.refresh(score)
    score.project = project

    return serialize_score(score, rubric)
