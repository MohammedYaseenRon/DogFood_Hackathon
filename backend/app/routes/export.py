import csv
import io

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role
from app.database import get_db
from app.models import Project, Role, RubricCriterion, Score, Team
from app.services.events import resolve_event

router = APIRouter()


@router.get("/api/export.csv")
def export_csv(request: Request, event: str | None = None, db: Session = Depends(get_db)):
    """All judge scores, one row per (judge, project). Criteria columns follow the
    event rubric, plus any extra criteria present in the scores themselves."""
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])

    query = db.query(Score).options(
        joinedload(Score.project).joinedload(Project.track),
        joinedload(Score.project).joinedload(Project.team),
        joinedload(Score.judge),
    )
    rubric_names: list[str] = []
    if event:
        target = resolve_event(db, event)
        query = query.join(Score.project).join(Project.team).filter(Team.event_id == target.id)
        rubric_names = [
            row.name
            for row in db.query(RubricCriterion)
            .filter(RubricCriterion.event_id == target.id)
            .order_by(RubricCriterion.name.asc())
        ]
    scores = query.all()

    extra = sorted({name for score in scores for name in (score.criteria or {})} - set(rubric_names))
    criteria_columns = rubric_names + extra

    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(["project_id", "title", "track", "judge", *criteria_columns, "comment"])
    for score in sorted(scores, key=lambda s: (s.project.fixture_id or "", s.judge.fixture_id or "")):
        criteria = score.criteria or {}
        writer.writerow(
            [
                score.project.fixture_id or score.project_id,
                score.project.title,
                score.project.track.name if score.project.track else "",
                score.judge.fixture_id or score.judge.email,
                *[criteria.get(name, "") for name in criteria_columns],
                score.comment,
            ]
        )

    filename = f"scores-{event}.csv" if event else "scores.csv"
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
