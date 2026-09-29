"""Event lookup, serialization, and configuration sync shared by the routers."""

import re
from datetime import datetime, timezone

from fastapi import HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models import (
    CustomQuestion,
    Event,
    EventRegistration,
    Prize,
    Project,
    ProjectCustomAnswer,
    ProjectStatus,
    RubricCriterion,
    Team,
    Track,
    User,
    new_id,
)
from app.services.event_state import can_submit, event_state_payload, voting_state

QUESTION_TYPES = {"text", "textarea", "url", "select"}
DEFAULT_RUBRIC = ("functionality", "quality", "innovation")


# --------------------------------------------------------------------------
# Lookup
# --------------------------------------------------------------------------


def _event_query(db: Session):
    return db.query(Event).options(
        joinedload(Event.tracks),
        joinedload(Event.rubric),
        joinedload(Event.prizes).joinedload(Prize.track),
        joinedload(Event.custom_questions),
    )


def find_event(db: Session, ref: str) -> Event | None:
    """Resolve an event by slug, fixture id, or internal id."""
    return (
        _event_query(db)
        .filter(or_(Event.slug == ref, Event.fixture_id == ref, Event.id == ref))
        .first()
    )


def get_event_or_404(db: Session, ref: str, *, include_unpublished: bool = False) -> Event:
    event = find_event(db, ref)
    if not event or (not event.published and not include_unpublished):
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def default_event(db: Session) -> Event | None:
    """The event the portal features when none is named.

    Preference: an event accepting submissions (closing soonest), then one with
    registration open, then the most recently created published event.
    """
    events = _event_query(db).filter(Event.published.is_(True)).all()
    if not events:
        return None

    open_events = [event for event in events if can_submit(event)]
    if open_events:
        return min(open_events, key=lambda event: event.submissions_close)

    now = datetime.utcnow()
    upcoming = [event for event in events if event.submissions_close >= now]
    if upcoming:
        return min(upcoming, key=lambda event: event.submissions_close)

    return max(events, key=lambda event: event.created_at or datetime.min)


def resolve_event(db: Session, ref: str | None) -> Event:
    """Named event if given, otherwise the featured default event."""
    if ref:
        return get_event_or_404(db, ref, include_unpublished=True)
    event = default_event(db)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def unique_slug(db: Session, name: str, *, exclude_id: str | None = None) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or new_id()[:8]
    slug = base
    counter = 2
    while True:
        query = db.query(Event).filter(Event.slug == slug)
        if exclude_id:
            query = query.filter(Event.id != exclude_id)
        if not query.first():
            return slug
        slug = f"{base}-{counter}"
        counter += 1


# --------------------------------------------------------------------------
# Serialization
# --------------------------------------------------------------------------


def iso(value: datetime | None) -> str | None:
    return value.isoformat() + "Z" if value else None


def serialize_question(question: CustomQuestion) -> dict:
    return {
        "id": question.id,
        "label": question.label,
        "type": question.question_type,
        "required": question.required,
        "options": question.options or [],
    }


def serialize_event_ref(event: Event) -> dict:
    """Small event payload embedded in teams and projects."""
    state = event_state_payload(event)
    return {
        "id": event.fixture_id,
        "slug": event.slug or event.fixture_id,
        "name": event.name,
        "submissionsClose": iso(event.submissions_close),
        "submissionsOpen": state["submissionsOpen"],
        "teamFormationOpen": state["teamFormationOpen"],
        "phase": state["phase"],
    }


def serialize_event(event: Event) -> dict:
    active_tracks = [track for track in event.tracks if track.active]
    return {
        "id": event.fixture_id,
        "internalId": event.id,
        "slug": event.slug or event.fixture_id,
        "name": event.name,
        "description": event.description,
        "shortDescription": event.short_description,
        "published": event.published,
        "registrationOpens": iso(event.registration_opens),
        "registrationCloses": iso(event.registration_closes),
        "eventStarts": iso(event.event_starts),
        "eventEnds": iso(event.event_ends),
        "submissionsClose": iso(event.submissions_close),
        "judgingStarts": iso(event.judging_starts),
        "judgingEnds": iso(event.judging_ends),
        "resultsAt": iso(event.results_at),
        "maxTeamSize": event.max_team_size,
        "state": event_state_payload(event),
        "tracks": [
            {
                "id": track.fixture_id,
                "name": track.name,
                "description": track.description,
            }
            for track in active_tracks
        ],
        "prizes": [
            {
                "id": prize.id,
                "name": prize.name,
                "amount": prize.amount,
                "rank": prize.rank,
                "trackId": prize.track.fixture_id if prize.track else None,
                "trackName": prize.track.name if prize.track else None,
            }
            for prize in sorted(event.prizes, key=lambda p: p.rank)
        ],
        "rubric": [
            {"name": criterion.name, "description": criterion.description, "weight": criterion.weight}
            for criterion in sorted(event.rubric, key=lambda c: (c.display_order, c.name))
        ],
        "questions": [serialize_question(q) for q in event.custom_questions],
        "voting": _voting_summary(event),
    }


def _voting_summary(event: Event) -> dict | None:
    config = event.voting_config
    state = voting_state(config)
    if state == "off":
        return None
    return {
        "state": state,
        "mode": config.mode.value,
        "access": config.access.value,
        "opensAt": iso(config.opens_at),
        "closesAt": iso(config.closes_at),
        "resultsPublished": config.results_published and state == "closed",
    }


def event_counts(db: Session, event: Event) -> dict:
    team_ids = [row.id for row in db.query(Team.id).filter(Team.event_id == event.id)]
    project_query = db.query(Project).filter(Project.team_id.in_(team_ids)) if team_ids else None
    submitted = (
        project_query.filter(Project.status == ProjectStatus.SUBMITTED).count()
        if project_query is not None
        else 0
    )
    drafts = (
        project_query.filter(Project.status == ProjectStatus.DRAFT).count()
        if project_query is not None
        else 0
    )
    return {
        "registrations": db.query(EventRegistration)
        .filter(EventRegistration.event_id == event.id)
        .count(),
        "teams": len(team_ids),
        "submitted": submitted,
        "drafts": drafts,
    }


# --------------------------------------------------------------------------
# Configuration payloads
# --------------------------------------------------------------------------


class TrackInput(BaseModel):
    id: str | None = None
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)


class PrizeInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    amount: str = Field(min_length=1, max_length=100)
    rank: int = Field(default=1, ge=1, le=1000)
    track_index: int | None = Field(default=None, ge=0)


class QuestionInput(BaseModel):
    id: str | None = None
    label: str = Field(min_length=1, max_length=300)
    type: str = Field(default="text")
    required: bool = False
    options: list[str] = Field(default_factory=list)

    @field_validator("type")
    @classmethod
    def _valid_type(cls, value: str) -> str:
        if value not in QUESTION_TYPES:
            raise ValueError(f"type must be one of {', '.join(sorted(QUESTION_TYPES))}")
        return value


class EventConfigBody(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(default=None, max_length=80)
    short_description: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=10000)
    published: bool = True
    max_team_size: int = Field(default=4, ge=1, le=20)
    registration_opens: str | None = None
    registration_closes: str | None = None
    event_starts: str | None = None
    event_ends: str | None = None
    submissions_close: str = Field(min_length=1)
    judging_starts: str | None = None
    judging_ends: str | None = None
    results_at: str | None = None
    tracks: list[TrackInput] = Field(min_length=1, max_length=50)
    prizes: list[PrizeInput] = Field(default_factory=list, max_length=50)
    questions: list[QuestionInput] = Field(default_factory=list, max_length=30)


DATE_FIELDS = (
    "registration_opens",
    "registration_closes",
    "event_starts",
    "event_ends",
    "submissions_close",
    "judging_starts",
    "judging_ends",
    "results_at",
)

# (earlier, later, message) — both must be set for the rule to apply.
DATE_ORDER_RULES = (
    ("registration_opens", "registration_closes", "Registration must open before it closes"),
    ("registration_opens", "submissions_close", "Registration must open before the submission deadline"),
    ("event_starts", "event_ends", "The event must start before it ends"),
    ("event_starts", "submissions_close", "The event must start before the submission deadline"),
    ("submissions_close", "judging_starts", "Judging cannot start before submissions close"),
    ("judging_starts", "judging_ends", "Judging must start before it ends"),
    ("submissions_close", "results_at", "Results cannot be published before submissions close"),
    ("judging_ends", "results_at", "Results cannot be published before judging ends"),
)


def parse_datetime(raw: str | None, field: str) -> datetime | None:
    if raw is None or raw == "":
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date for {field}") from exc
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def parse_event_dates(body: EventConfigBody) -> dict[str, datetime | None]:
    dates = {field: parse_datetime(getattr(body, field), field) for field in DATE_FIELDS}
    for earlier, later, message in DATE_ORDER_RULES:
        a, b = dates[earlier], dates[later]
        if a and b and a > b:
            raise HTTPException(status_code=400, detail=message)
    return dates


def apply_event_config(db: Session, event: Event, body: EventConfigBody) -> None:
    dates = parse_event_dates(body)

    names = [track.name.strip().lower() for track in body.tracks]
    if len(set(names)) != len(names):
        raise HTTPException(status_code=400, detail="Track names must be unique")

    event.name = body.name.strip()
    if body.slug is not None and body.slug.strip():
        wanted = re.sub(r"[^a-z0-9-]+", "-", body.slug.strip().lower()).strip("-")
        if not wanted:
            raise HTTPException(status_code=400, detail="Invalid slug")
        clash = db.query(Event).filter(Event.slug == wanted, Event.id != event.id).first()
        if clash:
            raise HTTPException(status_code=409, detail="Another event already uses that URL slug")
        event.slug = wanted
    elif not event.slug:
        event.slug = unique_slug(db, event.name, exclude_id=event.id)

    event.short_description = (body.short_description or "").strip() or None
    event.description = (body.description or "").strip() or None
    event.published = body.published
    event.max_team_size = body.max_team_size
    for field, value in dates.items():
        setattr(event, field, value)
    db.flush()  # a new event needs its id before tracks/prizes reference it

    tracks = _sync_tracks(db, event, body.tracks)
    _sync_prizes(db, event, body.prizes, tracks)
    _sync_questions(db, event, body.questions)
    _ensure_rubric(db, event)


def _sync_tracks(db: Session, event: Event, tracks: list[TrackInput]) -> list[Track]:
    existing = {track.fixture_id: track for track in event.tracks}
    ordered: list[Track] = []
    kept: set[str] = set()

    for index, track_input in enumerate(tracks):
        track = existing.get(track_input.id) if track_input.id else None
        if track is None:
            track = Track(fixture_id=new_id(), event_id=event.id, name=track_input.name.strip())
            db.add(track)
        track.name = track_input.name.strip()
        track.description = (track_input.description or "").strip() or None
        track.display_order = index
        track.active = True
        db.flush()
        kept.add(track.fixture_id)
        ordered.append(track)

    # Tracks dropped from the form: delete if unused, otherwise retire them so
    # existing submissions keep a valid track.
    for fixture_id, track in existing.items():
        if fixture_id in kept:
            continue
        in_use = db.query(Project).filter(Project.track_id == track.id).count()
        if in_use:
            track.active = False
        else:
            for prize in db.query(Prize).filter(Prize.track_id == track.id):
                db.delete(prize)
            db.delete(track)
    db.flush()
    return ordered


def _sync_prizes(db: Session, event: Event, prizes: list[PrizeInput], tracks: list[Track]) -> None:
    for prize in db.query(Prize).filter(Prize.event_id == event.id).all():
        db.delete(prize)
    db.flush()

    for prize_input in prizes:
        track_id = None
        if prize_input.track_index is not None:
            if prize_input.track_index >= len(tracks):
                raise HTTPException(status_code=400, detail="Invalid prize track_index")
            track_id = tracks[prize_input.track_index].id
        db.add(
            Prize(
                event_id=event.id,
                name=prize_input.name.strip(),
                amount=prize_input.amount.strip(),
                rank=prize_input.rank,
                track_id=track_id,
            )
        )


def _sync_questions(db: Session, event: Event, questions: list[QuestionInput]) -> None:
    existing = {
        question.id: question
        for question in db.query(CustomQuestion).filter(CustomQuestion.event_id == event.id)
    }
    kept: set[str] = set()

    for index, question_input in enumerate(questions):
        options = [option.strip() for option in question_input.options if option.strip()]
        if question_input.type == "select" and len(options) < 2:
            raise HTTPException(
                status_code=400,
                detail=f"Question '{question_input.label}' needs at least two options",
            )
        question = existing.get(question_input.id) if question_input.id else None
        if question is None:
            question = CustomQuestion(event_id=event.id, label="", question_type="text")
            db.add(question)
        question.label = question_input.label.strip()
        question.question_type = question_input.type
        question.required = question_input.required
        question.options = options if question_input.type == "select" else []
        question.display_order = index
        db.flush()
        kept.add(question.id)

    for question_id, question in existing.items():
        if question_id in kept:
            continue
        db.query(ProjectCustomAnswer).filter(
            ProjectCustomAnswer.question_id == question_id
        ).delete(synchronize_session=False)
        db.delete(question)
    db.flush()


def _ensure_rubric(db: Session, event: Event) -> None:
    has_rubric = db.query(RubricCriterion).filter(RubricCriterion.event_id == event.id).first()
    if has_rubric:
        return
    for order, name in enumerate(DEFAULT_RUBRIC):
        db.add(RubricCriterion(event_id=event.id, name=name, weight=1.0, display_order=order))


def ensure_registration(db: Session, event: Event, user: User) -> EventRegistration:
    registration = (
        db.query(EventRegistration)
        .filter(EventRegistration.event_id == event.id, EventRegistration.user_id == user.id)
        .first()
    )
    if registration:
        return registration
    registration = EventRegistration(event_id=event.id, user_id=user.id)
    db.add(registration)
    db.flush()
    return registration
