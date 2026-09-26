from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role
from app.database import get_db
from app.models import Project, Role, Score

router = APIRouter()


def csv_escape(value: str) -> str:
    if any(char in value for char in [",", '"', "\n"]):
        return f'"{value.replace(chr(34), chr(34) * 2)}"'
    return value


@router.get("/api/export.csv")
def export_csv(request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])

    scores = (
        db.query(Score)
        .options(joinedload(Score.project).joinedload(Project.track), joinedload(Score.judge))
        .all()
    )

    header = "project_id,title,track,judge,functionality,quality,innovation,comment"
    rows = []
    for score in scores:
        criteria = score.criteria or {}
        rows.append(
            ",".join(
                [
                    score.project.fixture_id or score.project_id,
                    csv_escape(score.project.title),
                    csv_escape(score.project.track.name),
                    csv_escape(score.judge.fixture_id or score.judge.email),
                    str(criteria.get("functionality", "")),
                    str(criteria.get("quality", "")),
                    str(criteria.get("innovation", "")),
                    csv_escape(score.comment),
                ]
            )
        )

    body = "\n".join([header, *rows])
    return Response(content=body, media_type="text/csv")
