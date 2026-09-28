import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.auth import get_session_user, require_role
from app.database import get_db
from app.models import (
    Event,
    Project,
    ProjectStatus,
    Role,
    Team,
    TeamMember,
    Track,
    User,
    new_id,
)
from app.services.audit import log_action
from app.services.event_state import can_submit

router = APIRouter()


class ProjectBody(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    tagline: str | None = Field(default=None, max_length=300)
    summary: str = Field(min_length=1, max_length=2000)
    repo_url: str = Field(min_length=1, max_length=500)
    demo_url: str | None = Field(default=None, max_length=500)
    live_url: str | None = Field(default=None, max_length=500)
    video_url: str | None = Field(default=None, max_length=500)
    thumbnail_url: str | None = Field(default=None, max_length=500)
    tech_tags: list[str] = Field(default_factory=list)
    track_id: str = Field(min_length=1)
    status: ProjectStatus = ProjectStatus.DRAFT


class ProjectUpdateBody(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    tagline: str | None = Field(default=None, max_length=300)
    summary: str | None = Field(default=None, min_length=1, max_length=2000)
    repo_url: str | None = Field(default=None, min_length=1, max_length=500)
    demo_url: str | None = Field(default=None, max_length=500)
    live_url: str | None = Field(default=None, max_length=500)
    video_url: str | None = Field(default=None, max_length=500)
    thumbnail_url: str | None = Field(default=None, max_length=500)
    tech_tags: list[str] | None = None
    track_id: str | None = Field(default=None, min_length=1)
    status: ProjectStatus | None = None


def _active_event(db: Session) -> Event:
    event = db.query(Event).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def _require_open(event: Event) -> None:
    if not can_submit(event):
        raise HTTPException(
            status_code=403,
            detail="Submission deadline has passed. Your project can no longer be modified.",
        )


def _participant_team(db: Session, user: User, event: Event) -> Team:
    membership = (
        db.query(TeamMember)
        .options(joinedload(TeamMember.team))
        .filter(TeamMember.user_id == user.id)
        .first()
    )
    if not membership or membership.team.event_id != event.id:
        raise HTTPException(
            status_code=403,
            detail="Join or create a team before submitting a project",
        )
    return membership.team


def _resolve_track(db: Session, event: Event, track_fixture_id: str) -> Track:
    track = (
        db.query(Track)
        .filter(Track.event_id == event.id, Track.fixture_id == track_fixture_id)
        .first()
    )
    if not track:
        raise HTTPException(status_code=400, detail="Invalid track")
    return track


def _serialize_project(project: Project, *, detail: bool = False) -> dict:
    payload = {
        "id": project.fixture_id,
        "internalId": project.id,
        "title": project.title,
        "tagline": project.tagline,
        "summary": project.summary,
        "trackName": project.track.name,
        "trackId": project.track.fixture_id,
        "teamName": project.team.name,
        "repoUrl": project.repo_url,
        "demoUrl": project.demo_url,
        "liveUrl": project.live_url,
        "videoUrl": project.video_url,
        "thumbnailUrl": project.thumbnail_url,
        "techTags": project.tech_tags or [],
        "status": project.status.value,
        "submittedAt": project.submitted_at.isoformat() + "Z"
        if project.submitted_at
        else None,
    }
    if detail:
        payload["teamId"] = project.team.id
        payload["members"] = [
            {
                "name": member.user.name or member.user.email,
                "email": member.user.email,
                "role": member.role.value,
            }
            for member in project.team.members
        ]
    return payload


async def _parse_body(request: Request) -> dict:
    raw = await request.body()
    if not raw:
        return {}
    return json.loads(raw)


@router.get("/api/stats/public")
def public_stats(db: Session = Depends(get_db)):
    from app.models import User

    event = db.query(Event).first()
    submitted_count = (
        db.query(Project).filter(Project.status == ProjectStatus.SUBMITTED).count()
    )
    return {
        "projectCount": submitted_count,
        "trackCount": db.query(Track).count(),
        "judgeCount": db.query(User).filter(User.role == Role.JUDGE).count(),
        "eventName": event.name if event else "Hackathon",
        "submissionsClose": event.submissions_close.isoformat() + "Z" if event else None,
        "submissionsOpen": bool(event and can_submit(event)),
    }


@router.get("/api/projects")
def list_projects(
    q: str | None = None,
    track: str | None = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(Project)
        .filter(Project.status == ProjectStatus.SUBMITTED)
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
            if needle in project.title.lower()
            or needle in (project.tagline or "").lower()
            or needle in project.summary.lower()
            or any(needle in tag.lower() for tag in (project.tech_tags or []))
            or needle in project.team.name.lower()
        ]
    return [_serialize_project(project) for project in projects]


@router.get("/api/projects/mine")
def my_project(request: Request, db: Session = Depends(get_db)):
    user = require_role(db, request, [Role.PARTICIPANT])
    event = _active_event(db)
    team = _participant_team(db, user, event)

    project = (
        db.query(Project)
        .options(joinedload(Project.track), joinedload(Project.team))
        .filter(Project.team_id == team.id)
        .first()
    )
    if not project:
        return {"project": None}
    return {"project": _serialize_project(project)}


@router.get("/api/projects/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = (
        db.query(Project)
        .options(
            joinedload(Project.track),
            joinedload(Project.team).joinedload(Team.members).joinedload(TeamMember.user),
        )
        .filter(
            (Project.fixture_id == project_id) | (Project.id == project_id),
            Project.status == ProjectStatus.SUBMITTED,
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"project": _serialize_project(project, detail=True)}


@router.post("/projects/new")
async def create_project(request: Request, db: Session = Depends(get_db)):
    user = require_role(db, request, [Role.PARTICIPANT])
    event = _active_event(db)
    _require_open(event)

    payload = ProjectBody(**await _parse_body(request))
    team = _participant_team(db, user, event)
    track = _resolve_track(db, event, payload.track_id)

    existing = db.query(Project).filter(Project.team_id == team.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Team already has a project")

    now = datetime.utcnow()
    project = Project(
        fixture_id=new_id(),
        title=payload.title.strip(),
        tagline=(payload.tagline or "").strip() or None,
        summary=payload.summary.strip(),
        repo_url=payload.repo_url.strip(),
        demo_url=(payload.demo_url or "").strip() or None,
        live_url=(payload.live_url or "").strip() or None,
        video_url=(payload.video_url or "").strip() or None,
        thumbnail_url=(payload.thumbnail_url or "").strip() or None,
        tech_tags=payload.tech_tags or [],
        status=payload.status,
        submitted_at=now if payload.status == ProjectStatus.SUBMITTED else None,
        team_id=team.id,
        track_id=track.id,
    )
    db.add(project)
    log_action(
        db,
        actor_id=user.id,
        action="project.created" if payload.status == ProjectStatus.DRAFT else "project.submitted",
        resource_type="project",
        resource_id=project.fixture_id,
    )
    db.commit()
    db.refresh(project)

    project = (
        db.query(Project)
        .options(joinedload(Project.track), joinedload(Project.team))
        .filter(Project.id == project.id)
        .first()
    )
    return _serialize_project(project)


@router.patch("/api/projects/{project_id}")
async def update_project(
    project_id: str, request: Request, db: Session = Depends(get_db)
):
    user = require_role(db, request, [Role.PARTICIPANT])
    event = _active_event(db)
    _require_open(event)

    payload = ProjectUpdateBody(**await _parse_body(request))
    team = _participant_team(db, user, event)

    project = (
        db.query(Project)
        .options(joinedload(Project.track), joinedload(Project.team))
        .filter(
            ((Project.fixture_id == project_id) | (Project.id == project_id)),
            Project.team_id == team.id,
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.title is not None:
        project.title = payload.title.strip()
    if payload.tagline is not None:
        project.tagline = payload.tagline.strip() or None
    if payload.summary is not None:
        project.summary = payload.summary.strip()
    if payload.repo_url is not None:
        project.repo_url = payload.repo_url.strip()
    if payload.demo_url is not None:
        project.demo_url = payload.demo_url.strip() or None
    if payload.live_url is not None:
        project.live_url = payload.live_url.strip() or None
    if payload.video_url is not None:
        project.video_url = payload.video_url.strip() or None
    if payload.thumbnail_url is not None:
        project.thumbnail_url = payload.thumbnail_url.strip() or None
    if payload.tech_tags is not None:
        project.tech_tags = payload.tech_tags
    if payload.track_id is not None:
        project.track_id = _resolve_track(db, event, payload.track_id).id
    if payload.status is not None:
        project.status = payload.status
        if payload.status == ProjectStatus.SUBMITTED and not project.submitted_at:
            project.submitted_at = datetime.utcnow()

    action = "project.submitted" if project.status == ProjectStatus.SUBMITTED else "project.updated"
    log_action(
        db,
        actor_id=user.id,
        action=action,
        resource_type="project",
        resource_id=project.fixture_id,
    )
    db.commit()
    db.refresh(project)
    return _serialize_project(project)


@router.get("/projects/new")
def new_project_info(request: Request, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"message": "Use the frontend form to submit projects"}
