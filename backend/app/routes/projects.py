"""Project submissions and the public gallery.

Lifecycle: a team has at most one project per event. It starts as a DRAFT
(only a title and track are required), can be edited freely, and becomes
SUBMITTED once every required field is valid. Any member can edit or
un-submit until the event deadline; after that every write returns 403.
"""

import json
import random
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError, field_validator
from sqlalchemy.orm import Session, joinedload

from app.auth import get_session_user, require_role
from app.database import get_db
from app.models import (
    Event,
    Project,
    ProjectCustomAnswer,
    ProjectStatus,
    Role,
    Team,
    TeamMember,
    Track,
    User,
    new_id,
)
from app.services.audit import log_action
from app.services.event_state import can_submit, submission_block_reason
from app.services.events import (
    default_event,
    get_event_or_404,
    iso,
    serialize_event_ref,
    serialize_question,
)

router = APIRouter(tags=["projects"])

URL_FIELDS = ("repo_url", "demo_url", "live_url", "video_url", "thumbnail_url")
URL_PATTERN = re.compile(r"^https?://[^\s/$.?#][^\s]*$", re.IGNORECASE)
MAX_IMAGES = 8
MAX_TAGS = 15


# --------------------------------------------------------------------------
# Payloads
# --------------------------------------------------------------------------


class ProjectFields(BaseModel):
    """Shared shape for create and update. Every field is optional here; the
    draft/submit rules are enforced in `_validate_for_status`."""

    event: str | None = None
    title: str | None = Field(default=None, max_length=200)
    tagline: str | None = Field(default=None, max_length=300)
    summary: str | None = Field(default=None, max_length=10000)
    repo_url: str | None = Field(default=None, max_length=500)
    demo_url: str | None = Field(default=None, max_length=500)
    live_url: str | None = Field(default=None, max_length=500)
    video_url: str | None = Field(default=None, max_length=500)
    thumbnail_url: str | None = Field(default=None, max_length=500)
    image_urls: list[str] | None = None
    tech_tags: list[str] | None = None
    track_id: str | None = None
    status: ProjectStatus | None = None
    answers: dict[str, str] | None = None

    @field_validator("image_urls")
    @classmethod
    def _images(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [url.strip() for url in value if url and url.strip()]
        if len(cleaned) > MAX_IMAGES:
            raise ValueError(f"At most {MAX_IMAGES} gallery images")
        for url in cleaned:
            if len(url) > 500 or not URL_PATTERN.match(url):
                raise ValueError(f"Invalid image URL: {url[:80]}")
        return cleaned

    @field_validator("tech_tags")
    @classmethod
    def _tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        seen: dict[str, str] = {}
        for tag in value:
            clean = re.sub(r"\s+", " ", (tag or "").strip())[:40]
            if clean and clean.lower() not in seen:
                seen[clean.lower()] = clean
        if len(seen) > MAX_TAGS:
            raise ValueError(f"At most {MAX_TAGS} tech tags")
        return list(seen.values())


async def _parse_fields(request: Request) -> ProjectFields:
    raw = await request.body()
    try:
        data = json.loads(raw) if raw else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Body must be JSON") from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Body must be a JSON object")
    try:
        return ProjectFields(**data)
    except ValidationError as exc:
        first = exc.errors()[0]
        field = ".".join(str(part) for part in first.get("loc", ()))
        message = first.get("msg", "Invalid value").removeprefix("Value error, ")
        raise HTTPException(status_code=422, detail=f"{field}: {message}" if field else message) from exc


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _require_open(event: Event) -> None:
    reason = submission_block_reason(event)
    if reason:
        raise HTTPException(status_code=403, detail=reason)


def _participant_team(db: Session, user: User, event_ref: str | None) -> Team:
    """The team this participant submits for.

    With an explicit event, it's their team in that event. Otherwise prefer a
    team whose event is accepting submissions, then their most recent team.
    """
    memberships = (
        db.query(TeamMember)
        .options(joinedload(TeamMember.team).joinedload(Team.event))
        .filter(TeamMember.user_id == user.id)
        .order_by(TeamMember.joined_at.desc())
        .all()
    )
    if event_ref:
        event = get_event_or_404(db, event_ref)
        memberships = [m for m in memberships if m.team.event_id == event.id]
    if not memberships:
        raise HTTPException(
            status_code=403,
            detail="Join or create a team for this event before submitting a project",
        )
    for membership in memberships:
        if membership.team.event and can_submit(membership.team.event):
            return membership.team
    return memberships[0].team


def _resolve_track(db: Session, event: Event, track_ref: str) -> Track:
    track = (
        db.query(Track)
        .filter(
            Track.event_id == event.id,
            (Track.fixture_id == track_ref) | (Track.id == track_ref),
        )
        .first()
    )
    if not track or not track.active:
        raise HTTPException(status_code=400, detail="Choose a valid track for this event")
    return track


def _apply_fields(db: Session, project: Project, event: Event, fields: ProjectFields) -> None:
    if fields.title is not None:
        project.title = fields.title.strip()
    if fields.tagline is not None:
        project.tagline = _clean(fields.tagline)
    if fields.summary is not None:
        project.summary = fields.summary.strip()
    for name in URL_FIELDS:
        value = getattr(fields, name)
        if value is not None:
            cleaned = _clean(value)
            if cleaned and not URL_PATTERN.match(cleaned):
                label = name.replace("_url", "").replace("_", " ")
                raise HTTPException(status_code=400, detail=f"{label.capitalize()} URL must start with http:// or https://")
            setattr(project, name, cleaned if name != "repo_url" else (cleaned or ""))
    if fields.image_urls is not None:
        project.image_urls = fields.image_urls
    if fields.tech_tags is not None:
        project.tech_tags = fields.tech_tags
    if fields.track_id is not None:
        project.track_id = _resolve_track(db, event, fields.track_id).id


def _apply_answers(db: Session, project: Project, event: Event, answers: dict[str, str] | None) -> None:
    if answers is None:
        return
    questions = {q.id: q for q in event.custom_questions}
    existing = {
        answer.question_id: answer
        for answer in db.query(ProjectCustomAnswer).filter(ProjectCustomAnswer.project_id == project.id)
    }
    for question_id, raw in answers.items():
        question = questions.get(question_id)
        if not question:
            raise HTTPException(status_code=400, detail="Unknown custom question")
        value = (raw or "").strip()
        if len(value) > 5000:
            raise HTTPException(status_code=400, detail=f"Answer to '{question.label}' is too long")
        if value and question.question_type == "url" and not URL_PATTERN.match(value):
            raise HTTPException(status_code=400, detail=f"Answer to '{question.label}' must be a URL")
        if value and question.question_type == "select" and value not in (question.options or []):
            raise HTTPException(status_code=400, detail=f"Pick one of the options for '{question.label}'")

        answer = existing.get(question_id)
        if value:
            if answer:
                answer.answer = value
            else:
                db.add(ProjectCustomAnswer(project_id=project.id, question_id=question_id, answer=value))
        elif answer:
            db.delete(answer)
    db.flush()


def _validate_for_status(db: Session, project: Project, event: Event) -> None:
    if not (project.title or "").strip():
        raise HTTPException(status_code=400, detail="Project title is required")
    if not project.track_id:
        raise HTTPException(status_code=400, detail="Choose a track")
    if project.status != ProjectStatus.SUBMITTED:
        return

    missing = []
    if not (project.summary or "").strip():
        missing.append("description")
    if not (project.repo_url or "").strip():
        missing.append("repository URL")
    answered = {
        answer.question_id
        for answer in db.query(ProjectCustomAnswer).filter(ProjectCustomAnswer.project_id == project.id)
    }
    for question in event.custom_questions:
        if question.required and question.id not in answered:
            missing.append(f"'{question.label}'")
    if missing:
        raise HTTPException(
            status_code=400,
            detail="To submit, fill in: " + ", ".join(missing) + ". You can still save as a draft.",
        )


def _load_project(db: Session, project_ref: str) -> Project | None:
    return (
        db.query(Project)
        .options(
            joinedload(Project.track),
            joinedload(Project.team).joinedload(Team.members).joinedload(TeamMember.user),
            joinedload(Project.team).joinedload(Team.event),
            joinedload(Project.custom_answers).joinedload(ProjectCustomAnswer.question),
        )
        .filter((Project.fixture_id == project_ref) | (Project.id == project_ref))
        .first()
    )


def _is_team_member(project: Project, user: User | None) -> bool:
    return bool(user and any(member.user_id == user.id for member in project.team.members))


def _serialize_project(project: Project, *, detail: bool = False, private: bool = False) -> dict:
    event = project.team.event
    payload = {
        "id": project.fixture_id,
        "internalId": project.id,
        "title": project.title,
        "tagline": project.tagline,
        "summary": project.summary,
        "trackName": project.track.name if project.track else None,
        "trackId": project.track.fixture_id if project.track else None,
        "teamName": project.team.name,
        "memberCount": len(project.team.members),
        "repoUrl": project.repo_url or None,
        "demoUrl": project.demo_url,
        "liveUrl": project.live_url,
        "videoUrl": project.video_url,
        "thumbnailUrl": project.thumbnail_url,
        "imageUrls": project.image_urls or [],
        "techTags": project.tech_tags or [],
        "status": project.status.value,
        "submittedAt": iso(project.submitted_at),
        "updatedAt": iso(project.updated_at),
        "event": serialize_event_ref(event) if event else None,
    }
    if detail:
        payload["teamId"] = project.team.id
        payload["members"] = [
            {
                "name": member.user.name or member.user.email.split("@")[0],
                "role": member.role.value,
                # Emails are only shown to the team and staff.
                **({"email": member.user.email} if private else {}),
            }
            for member in project.team.members
        ]
    if private:
        answers = {answer.question_id: answer.answer for answer in project.custom_answers}
        payload["answers"] = answers
        payload["questions"] = [
            {**serialize_question(question), "answer": answers.get(question.id)}
            for question in (event.custom_questions if event else [])
        ]
    return payload


def _refresh(db: Session, project_id: str) -> Project:
    project = _load_project(db, project_id)
    assert project is not None
    return project


# --------------------------------------------------------------------------
# Public gallery
# --------------------------------------------------------------------------


@router.get("/api/stats/public")
def public_stats(db: Session = Depends(get_db)):
    event = default_event(db)
    published_events = db.query(Event).filter(Event.published.is_(True))
    submitted_count = (
        db.query(Project)
        .join(Project.team)
        .join(Team.event)
        .filter(Project.status == ProjectStatus.SUBMITTED, Event.published.is_(True))
        .count()
    )
    return {
        "projectCount": submitted_count,
        "eventCount": published_events.count(),
        "trackCount": db.query(Track).filter(Track.active.is_(True)).count(),
        "judgeCount": db.query(User).filter(User.role == Role.JUDGE).count(),
        "eventName": event.name if event else "Hackathon",
        "eventSlug": event.slug if event else None,
        "submissionsClose": iso(event.submissions_close) if event else None,
        "submissionsOpen": bool(event and can_submit(event)),
    }


def _gallery_query(db: Session, event: str | None, track: str | None):
    query = (
        db.query(Project)
        .join(Project.team)
        .join(Team.event)
        .filter(Project.status == ProjectStatus.SUBMITTED, Event.published.is_(True))
        .options(
            joinedload(Project.track),
            joinedload(Project.team).joinedload(Team.members),
            joinedload(Project.team).joinedload(Team.event),
        )
    )
    if event:
        target = get_event_or_404(db, event)
        query = query.filter(Team.event_id == target.id)
    if track:
        query = query.join(Project.track).filter(Track.fixture_id == track)
    return query


def _matches(project: Project, needle: str) -> bool:
    haystack = " ".join(
        [
            project.title,
            project.tagline or "",
            project.summary or "",
            project.team.name,
            project.track.name if project.track else "",
            " ".join(project.tech_tags or []),
        ]
    ).lower()
    return all(term in haystack for term in needle.lower().split())


@router.get("/api/projects")
def list_projects(
    q: str | None = None,
    track: str | None = None,
    event: str | None = None,
    tag: str | None = None,
    sort: str = "title",
    seed: int | None = None,
    db: Session = Depends(get_db),
):
    projects = _gallery_query(db, event, track).all()

    if q and q.strip():
        projects = [p for p in projects if _matches(p, q.strip())]
    if tag:
        wanted = tag.strip().lower()
        projects = [p for p in projects if any(t.lower() == wanted for t in (p.tech_tags or []))]

    if sort == "newest":
        projects.sort(key=lambda p: p.submitted_at or datetime.min, reverse=True)
    elif sort == "oldest":
        projects.sort(key=lambda p: p.submitted_at or datetime.min)
    elif sort == "random":
        # Seeded so pagination/refresh are stable for one visitor.
        random.Random(seed if seed is not None else 0).shuffle(projects)
    else:
        projects.sort(key=lambda p: p.title.lower())

    return [_serialize_project(project) for project in projects]


@router.get("/api/projects/facets")
def gallery_facets(event: str | None = None, db: Session = Depends(get_db)):
    """Filter options for the gallery: tracks and tech tags with counts."""
    projects = _gallery_query(db, event, None).all()
    tracks: dict[str, dict] = {}
    tags: dict[str, dict] = {}
    for project in projects:
        if project.track:
            entry = tracks.setdefault(
                project.track.fixture_id,
                {"id": project.track.fixture_id, "name": project.track.name, "count": 0},
            )
            entry["count"] += 1
        for tag in project.tech_tags or []:
            entry = tags.setdefault(tag.lower(), {"name": tag, "count": 0})
            entry["count"] += 1
    return {
        "total": len(projects),
        "tracks": sorted(tracks.values(), key=lambda t: t["name"].lower()),
        "tags": sorted(tags.values(), key=lambda t: (-t["count"], t["name"].lower()))[:40],
    }


# --------------------------------------------------------------------------
# Participant submission
# --------------------------------------------------------------------------


@router.get("/api/projects/mine")
def my_project(request: Request, event: str | None = None, db: Session = Depends(get_db)):
    user = require_role(db, request, [Role.PARTICIPANT])
    team = _participant_team(db, user, event)
    project = db.query(Project).filter(Project.team_id == team.id).first()
    return {
        "project": _serialize_project(_refresh(db, project.id), detail=True, private=True)
        if project
        else None,
        "team": {"id": team.id, "name": team.name},
        "event": serialize_event_ref(team.event),
    }


@router.get("/api/projects/{project_id}")
def get_project(project_id: str, request: Request, db: Session = Depends(get_db)):
    project = _load_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user = get_session_user(db, request)
    is_member = _is_team_member(project, user)
    is_staff = bool(user and user.role in {Role.ORGANIZER, Role.ADMIN, Role.JUDGE})
    event = project.team.event
    publicly_visible = project.status == ProjectStatus.SUBMITTED and event and event.published

    # Drafts (and projects of unpublished events) exist only for their team and staff.
    if not publicly_visible and not (is_member or is_staff):
        raise HTTPException(status_code=404, detail="Project not found")

    payload = _serialize_project(project, detail=True, private=is_member or is_staff)
    payload["canEdit"] = bool(is_member and event and can_submit(event))
    return {"project": payload}


@router.post("/projects/new")
@router.post("/api/projects")
async def create_project(request: Request, db: Session = Depends(get_db)):
    user = require_role(db, request, [Role.PARTICIPANT])
    fields = await _parse_fields(request)
    team = _participant_team(db, user, fields.event)
    event = team.event
    _require_open(event)

    if db.query(Project).filter(Project.team_id == team.id).first():
        raise HTTPException(status_code=409, detail="Your team already has a project — edit it instead")
    if not fields.track_id:
        raise HTTPException(status_code=400, detail="Choose a track")

    status = fields.status or ProjectStatus.DRAFT
    project = Project(
        fixture_id=new_id(),
        title="",
        summary="",
        repo_url="",
        tech_tags=[],
        image_urls=[],
        status=status,
        team_id=team.id,
        track_id=None,
    )
    _apply_fields(db, project, event, fields)
    db.add(project)
    db.flush()
    _apply_answers(db, project, event, fields.answers)
    _validate_for_status(db, project, event)
    if status == ProjectStatus.SUBMITTED:
        project.submitted_at = datetime.utcnow()

    log_action(
        db,
        actor_id=user.id,
        action="project.submitted" if status == ProjectStatus.SUBMITTED else "project.created",
        resource_type="project",
        resource_id=project.fixture_id,
        metadata={"event": event.fixture_id},
    )
    db.commit()
    return _serialize_project(_refresh(db, project.id), detail=True, private=True)


@router.patch("/api/projects/{project_id}")
async def update_project(project_id: str, request: Request, db: Session = Depends(get_db)):
    user = require_role(db, request, [Role.PARTICIPANT])
    project = _load_project(db, project_id)
    if not project or not _is_team_member(project, user):
        raise HTTPException(status_code=404, detail="Project not found")

    event = project.team.event
    _require_open(event)
    fields = await _parse_fields(request)

    previous_status = project.status
    _apply_fields(db, project, event, fields)
    _apply_answers(db, project, event, fields.answers)
    if fields.status is not None:
        project.status = fields.status
    _validate_for_status(db, project, event)

    if project.status == ProjectStatus.SUBMITTED:
        # Resubmitting refreshes the timestamp; editing a submitted project keeps it.
        if previous_status != ProjectStatus.SUBMITTED or not project.submitted_at:
            project.submitted_at = datetime.utcnow()
    else:
        project.submitted_at = None

    if previous_status != project.status:
        action = "project.submitted" if project.status == ProjectStatus.SUBMITTED else "project.unsubmitted"
    else:
        action = "project.updated"
    log_action(
        db,
        actor_id=user.id,
        action=action,
        resource_type="project",
        resource_id=project.fixture_id,
    )
    db.commit()
    return _serialize_project(_refresh(db, project.id), detail=True, private=True)


@router.get("/projects/new")
def new_project_info(request: Request, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"message": "Use the frontend form to submit projects"}

