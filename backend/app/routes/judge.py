from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role, resolve_judge_alias
from app.database import get_db
from app.lib.scoring import validate_criteria, weighted_total
from app.models import Event, JudgeAssignment, Project, Role, RubricCriterion, Score

router = APIRouter()


class ScoreSubmit(BaseModel):
    project_id: str = Field(description="Fixture project id, e.g. prj_01")
    criteria: dict[str, float]
    comment: str = ""


def get_event_rubric(db: Session) -> list[RubricCriterion]:
    event = db.query(Event).first()
    if not event:
        return []
    return (
        db.query(RubricCriterion)
        .filter(RubricCriterion.event_id == event.id)
        .order_by(RubricCriterion.name.asc())
        .all()
    )


def resolve_project(db: Session, project_id: str) -> Project | None:
    return (
        db.query(Project)
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
    }


@router.get("/api/judge/rubric")
def judge_rubric(request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.JUDGE])
    rubric = get_event_rubric(db)
    return [
        {"name": item.name, "weight": item.weight}
        for item in rubric
    ]


@router.get("/api/judge/assignments")
def judge_assignments(request: Request, db: Session = Depends(get_db)):
    user = require_role(db, request, [Role.JUDGE])
    rubric = get_event_rubric(db)

    assignments = (
        db.query(JudgeAssignment)
        .options(joinedload(JudgeAssignment.project).joinedload(Project.track))
        .filter(JudgeAssignment.judge_id == user.id)
        .all()
    )

    scores = {
        score.project_id: score
        for score in db.query(Score).filter(Score.judge_id == user.id).all()
    }

    result = []
    for assignment in assignments:
        score = scores.get(assignment.project_id)
        entry = {
            "projectId": assignment.project.fixture_id or assignment.project_id,
            "title": assignment.project.title,
            "summary": assignment.project.summary,
            "trackName": assignment.project.track.name,
            "scored": score is not None,
        }
        if score:
            criteria = score.criteria or {}
            entry["criteria"] = criteria
            entry["comment"] = score.comment
            entry["weightedTotal"] = weighted_total(criteria, rubric)
        result.append(entry)

    return result


@router.get("/api/judge/scores")
def judge_scores(
    request: Request,
    judge: str | None = None,
    db: Session = Depends(get_db),
):
    user = require_role(db, request, [Role.JUDGE])
    target_judge_id = user.id

    if judge:
        target = resolve_judge_alias(db, judge)
        if not target:
            raise HTTPException(status_code=404, detail="Judge not found")
        if target.id != user.id:
            raise HTTPException(status_code=403, detail="Cannot view another judge's scores")
        target_judge_id = target.id

    rubric = get_event_rubric(db)
    scores = (
        db.query(Score)
        .options(joinedload(Score.project))
        .filter(Score.judge_id == target_judge_id)
        .all()
    )

    return [serialize_score(score, rubric) for score in scores]


@router.post("/api/judge/scores")
def submit_score(
    body: ScoreSubmit,
    request: Request,
    db: Session = Depends(get_db),
):
    user = require_role(db, request, [Role.JUDGE])
    project = resolve_project(db, body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    assignment = (
        db.query(JudgeAssignment)
        .filter(
            JudgeAssignment.judge_id == user.id,
            JudgeAssignment.project_id == project.id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=403, detail="Not assigned to this project")

    rubric = get_event_rubric(db)
    try:
        validate_criteria(body.criteria, rubric)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    score = (
        db.query(Score)
        .filter(Score.judge_id == user.id, Score.project_id == project.id)
        .first()
    )
    if score:
        score.criteria = body.criteria
        score.comment = body.comment
    else:
        score = Score(
            judge_id=user.id,
            project_id=project.id,
            criteria=body.criteria,
            comment=body.comment,
        )
        db.add(score)

    db.commit()
    db.refresh(score)
    score.project = project

    return serialize_score(score, rubric)
