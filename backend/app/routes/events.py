from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

import re

from app.auth import get_session_user, require_role
from app.database import get_db
from app.models import Event, EventRegistration, Prize, Role, RubricCriterion, Track, User, new_id
from app.services.audit import log_action
from app.services.event_state import can_register, event_state_payload

router = APIRouter(tags=["events"])


class PrizeInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    amount: str = Field(min_length=1, max_length=100)
    rank: int = Field(default=1, ge=1)
    track_index: int | None = Field(default=None, ge=0)


class TrackInput(BaseModel):
    id: str | None = None
    name: str = Field(min_length=1, max_length=200)


class EventConfigBody(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    submissions_close: str = Field(min_length=1)
    tracks: list[TrackInput] = Field(min_length=1)
    prizes: list[PrizeInput] = Field(default_factory=list)


def _parse_close_date(raw: str) -> datetime:
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid submissions_close") from exc


def _load_event(db: Session, event_id: str | None = None) -> Event | None:
    query = db.query(Event).options(
        joinedload(Event.tracks),
        joinedload(Event.rubric),
        joinedload(Event.prizes).joinedload(Prize.track),
    )
    if event_id:
        return query.filter(Event.fixture_id == event_id).first()
    return query.first()


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or new_id()[:8]


def _serialize_event(event: Event) -> dict:
    state = event_state_payload(event)
    return {
        "id": event.fixture_id,
        "internalId": event.id,
        "slug": event.slug or event.fixture_id,
        "name": event.name,
        "description": event.description,
        "shortDescription": event.short_description,
        "submissionsClose": event.submissions_close.isoformat() + "Z",
        "registrationOpens": event.registration_opens.isoformat() + "Z"
        if event.registration_opens
        else None,
        "registrationCloses": event.registration_closes.isoformat() + "Z"
        if event.registration_closes
        else None,
        "maxTeamSize": event.max_team_size,
        "state": state,
        "tracks": [
            {
                "id": track.fixture_id,
                "name": track.name,
                "description": track.description,
            }
            for track in event.tracks
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
            {"name": criterion.name, "weight": criterion.weight}
            for criterion in event.rubric
        ],
    }


def _sync_tracks(db: Session, event: Event, tracks: list[TrackInput]) -> list[Track]:
    existing = {track.fixture_id: track for track in event.tracks}
    ordered: list[Track] = []

    for track_input in tracks:
        name = track_input.name.strip()
        if track_input.id and track_input.id in existing:
            track = existing[track_input.id]
            track.name = name
            ordered.append(track)
        else:
            track = Track(fixture_id=new_id(), name=name, event_id=event.id)
            db.add(track)
            db.flush()
            ordered.append(track)

    return ordered


def _sync_prizes(
    db: Session, event: Event, prizes: list[PrizeInput], tracks: list[Track]
) -> None:
    for prize in list(event.prizes):
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


def _ensure_rubric(db: Session, event: Event) -> None:
    if event.rubric:
        return
    for name in ("functionality", "quality", "innovation"):
        db.add(RubricCriterion(event_id=event.id, name=name, weight=1.0))


@router.get("/api/event")
def get_event(db: Session = Depends(get_db)):
    event = _load_event(db)
    if not event:
        return {"event": None}
    return {"event": _serialize_event(event)}


@router.get("/api/events")
def list_events(db: Session = Depends(get_db)):
    events = db.query(Event).filter(Event.published.is_(True)).all()
    return {"events": [_serialize_event(event) for event in events]}


@router.get("/api/events/{slug}")
def get_event_by_slug(slug: str, db: Session = Depends(get_db)):
    event = (
        db.query(Event)
        .options(
            joinedload(Event.tracks),
            joinedload(Event.rubric),
            joinedload(Event.prizes).joinedload(Prize.track),
        )
        .filter((Event.slug == slug) | (Event.fixture_id == slug))
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"event": _serialize_event(event)}


@router.get("/api/events/registration/mine")
def my_registration(request: Request, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    event = db.query(Event).first()
    if not event:
        return {"registered": False, "registration": None}
    reg = (
        db.query(EventRegistration)
        .filter(EventRegistration.event_id == event.id, EventRegistration.user_id == user.id)
        .first()
    )
    if not reg:
        return {"registered": False, "registration": None}
    return {
        "registered": True,
        "registration": {
            "eventId": event.fixture_id,
            "registeredAt": reg.registered_at.isoformat() + "Z",
        },
    }


@router.post("/api/events/register")
def register_for_event(request: Request, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if user.role not in {Role.VISITOR, Role.PARTICIPANT}:
        raise HTTPException(status_code=403, detail="Forbidden")

    event = db.query(Event).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not can_register(event):
        raise HTTPException(status_code=403, detail="Registration is not open")

    existing = (
        db.query(EventRegistration)
        .filter(EventRegistration.event_id == event.id, EventRegistration.user_id == user.id)
        .first()
    )
    if existing:
        return {
            "ok": True,
            "alreadyRegistered": True,
            "registration": {
                "registeredAt": existing.registered_at.isoformat() + "Z",
            },
        }

    if user.role == Role.VISITOR:
        user.role = Role.PARTICIPANT

    reg = EventRegistration(event_id=event.id, user_id=user.id)
    db.add(reg)
    log_action(
        db,
        actor_id=user.id,
        action="event.registered",
        resource_type="event",
        resource_id=event.id,
    )
    db.commit()
    return {
        "ok": True,
        "alreadyRegistered": False,
        "registration": {"registeredAt": reg.registered_at.isoformat() + "Z"},
    }


@router.post("/api/events")
def create_event(body: EventConfigBody, request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])

    if db.query(Event).first():
        raise HTTPException(
            status_code=409,
            detail="An event already exists. Use edit to update it.",
        )

    name = body.name.strip()
    event = Event(
        fixture_id=new_id(),
        slug=_slugify(name),
        name=name,
        submissions_close=_parse_close_date(body.submissions_close),
    )
    db.add(event)
    db.flush()

    tracks = _sync_tracks(db, event, body.tracks)
    _sync_prizes(db, event, body.prizes, tracks)
    _ensure_rubric(db, event)
    db.commit()

    event = _load_event(db, event.fixture_id)
    return {"event": _serialize_event(event)}


@router.patch("/api/events")
def update_event(body: EventConfigBody, request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])

    event = db.query(Event).first()
    if not event:
        raise HTTPException(status_code=404, detail="No event to update")

    event.name = body.name.strip()
    event.submissions_close = _parse_close_date(body.submissions_close)

    tracks = _sync_tracks(db, event, body.tracks)
    _sync_prizes(db, event, body.prizes, tracks)
    _ensure_rubric(db, event)
    db.commit()

    event = _load_event(db, event.fixture_id)
    return {"event": _serialize_event(event)}
