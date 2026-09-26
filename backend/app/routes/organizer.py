from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models import Event, JudgeAssignment, Project, Role, RubricCriterion, Score, User

router = APIRouter(prefix="/api/organizer", tags=["organizer"])


class RubricUpdate(BaseModel):
    criteria: list[dict[str, float | str]] = Field(
        description="List of {name, weight} objects"
    )


@router.get("/stats")
def organizer_stats(request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])

    total_projects = db.query(Project).count()
    total_judges = db.query(User).filter(User.role == Role.JUDGE).count()
    total_assignments = db.query(JudgeAssignment).count()
    total_scores = db.query(Score).count()

    completion = 0.0
    if total_assignments:
        completion = round((total_scores / total_assignments) * 100, 1)

    judges = (
        db.query(User)
        .filter(User.role == Role.JUDGE)
        .all()
    )

    judge_progress = []
    for judge in judges:
        assigned = (
            db.query(JudgeAssignment)
            .filter(JudgeAssignment.judge_id == judge.id)
            .count()
        )
        completed = (
            db.query(Score)
            .filter(Score.judge_id == judge.id)
            .count()
        )
        judge_progress.append(
            {
                "id": judge.fixture_id or judge.id,
                "name": judge.name or judge.email,
                "assigned": assigned,
                "completed": completed,
                "percent": round((completed / assigned) * 100, 1) if assigned else 0,
            }
        )

    return {
        "totalProjects": total_projects,
        "totalJudges": total_judges,
        "totalAssignments": total_assignments,
        "totalScores": total_scores,
        "completionPercent": completion,
        "judgeProgress": judge_progress,
    }


@router.get("/rubric")
def get_rubric(request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    event = db.query(Event).first()
    if not event:
        return {"criteria": []}

    rubric = (
        db.query(RubricCriterion)
        .filter(RubricCriterion.event_id == event.id)
        .order_by(RubricCriterion.name.asc())
        .all()
    )
    return {
        "criteria": [{"name": item.name, "weight": item.weight} for item in rubric]
    }


@router.patch("/rubric")
def update_rubric(
    body: RubricUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    event = db.query(Event).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    for item in body.criteria:
        name = str(item["name"])
        weight = float(item["weight"])
        if weight <= 0:
            raise HTTPException(status_code=400, detail=f"Weight for {name} must be positive")

        row = (
            db.query(RubricCriterion)
            .filter(RubricCriterion.event_id == event.id, RubricCriterion.name == name)
            .first()
        )
        if row:
            row.weight = weight
        else:
            db.add(RubricCriterion(event_id=event.id, name=name, weight=weight))

    db.commit()
    return get_rubric(request, db)
