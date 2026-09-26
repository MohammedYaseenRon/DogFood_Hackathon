from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from app.auth import get_session_user, require_role
from app.database import get_db
from app.models import Event, Project, Role, Track

router = APIRouter()


@router.get("/api/stats/public")
def public_stats(db: Session = Depends(get_db)):
    from app.models import Track, User

    event = db.query(Event).first()
    return {
        "projectCount": db.query(Project).count(),
        "trackCount": db.query(Track).count(),
        "judgeCount": db.query(User).filter(User.role == Role.JUDGE).count(),
        "eventName": event.name if event else "Hackathon",
        "submissionsClose": event.submissions_close.isoformat() + "Z" if event else None,
        "submissionsOpen": bool(event and datetime.utcnow() <= event.submissions_close),
    }


@router.get("/api/projects")
def list_projects(
    q: str | None = None,
    track: str | None = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(Project)
        .options(joinedload(Project.track), joinedload(Project.team))
        .order_by(Project.title.asc())
    )

    if track:
        query = query.join(Project.track).filter(Track.fixture_id == track)

    projects = query.all()

    if q:
        needle = q.lower()
        projects = [
            project
            for project in projects
            if needle in project.title.lower() or needle in project.summary.lower()
        ]
    return [
        {
            "id": project.id,
            "title": project.title,
            "summary": project.summary,
            "trackName": project.track.name,
            "teamName": project.team.name,
            "repoUrl": project.repo_url,
        }
        for project in projects
    ]


@router.post("/projects/new")
async def create_project(request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.PARTICIPANT])

    event = db.query(Event).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if datetime.utcnow() > event.submissions_close:
        raise HTTPException(status_code=403, detail="Submissions are closed")

    raise HTTPException(status_code=501, detail="Submission creation not implemented yet")


@router.get("/projects/new")
def new_project_info(request: Request, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"message": "Use the frontend form to submit projects"}
