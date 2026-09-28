from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_session_user, require_role, require_user
from app.database import get_db
from app.models import Event, EventRegistration, Role, new_id
from app.services.audit import log_action
from app.services.event_state import can_register
from app.services.events import (
    EventConfigBody,
    apply_event_config,
    default_event,
    ensure_registration,
    event_counts,
    get_event_or_404,
    iso,
    resolve_event,
    serialize_event,
    unique_slug,
)

router = APIRouter(tags=["events"])

MANAGER_ROLES = {Role.ORGANIZER, Role.ADMIN}


class RegisterBody(BaseModel):
    event: str | None = None


def _is_manager(db: Session, request: Request) -> bool:
    user = get_session_user(db, request)
    return bool(user and user.role in MANAGER_ROLES)


def _registration_payload(event: Event, registration: EventRegistration | None) -> dict:
    if not registration:
        return {"registered": False, "registration": None}
    return {
        "registered": True,
        "registration": {
            "eventId": event.fixture_id,
            "eventSlug": event.slug,
            "registeredAt": iso(registration.registered_at),
        },
    }


@router.get("/api/event")
def get_default_event(db: Session = Depends(get_db)):
    """The featured event (open for submissions first). Kept for older clients."""
    event = default_event(db)
    return {"event": serialize_event(event) if event else None}


@router.get("/api/events")
def list_events(request: Request, scope: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Event)
    if scope == "all":
        if not _is_manager(db, request):
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        query = query.filter(Event.published.is_(True))

    events = query.order_by(Event.submissions_close.desc()).all()
    payload = []
    for event in events:
        item = serialize_event(event)
        if scope == "all":
            item["counts"] = event_counts(db, event)
        payload.append(item)
    return {"events": payload}


@router.get("/api/events/registration/mine")
def my_registration(
    request: Request, event: str | None = None, db: Session = Depends(get_db)
):
    user = require_user(db, request)
    target = resolve_event(db, event)
    registration = (
        db.query(EventRegistration)
        .filter(EventRegistration.event_id == target.id, EventRegistration.user_id == user.id)
        .first()
    )
    return _registration_payload(target, registration)


@router.post("/api/events/register")
def register_for_event(
    request: Request, body: RegisterBody | None = None, db: Session = Depends(get_db)
):
    user = require_user(db, request)
    if user.role not in {Role.VISITOR, Role.PARTICIPANT}:
        raise HTTPException(
            status_code=403,
            detail=f"{user.role.value.title()} accounts cannot register as participants",
        )

    event = resolve_event(db, body.event if body else None)
    if not event.published:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = (
        db.query(EventRegistration)
        .filter(EventRegistration.event_id == event.id, EventRegistration.user_id == user.id)
        .first()
    )
    if existing:
        return {"ok": True, "alreadyRegistered": True, **_registration_payload(event, existing)}

    if not can_register(event):
        raise HTTPException(status_code=403, detail="Registration is not open for this event")

    if user.role == Role.VISITOR:
        user.role = Role.PARTICIPANT

    registration = ensure_registration(db, event, user)
    log_action(
        db,
        actor_id=user.id,
        action="event.registered",
        resource_type="event",
        resource_id=event.fixture_id,
    )
    db.commit()
    return {"ok": True, "alreadyRegistered": False, **_registration_payload(event, registration)}


@router.post("/api/events/{slug}/register")
def register_for_event_by_slug(slug: str, request: Request, db: Session = Depends(get_db)):
    return register_for_event(request, RegisterBody(event=slug), db)


@router.get("/api/events/{slug}")
def get_event_by_slug(slug: str, request: Request, db: Session = Depends(get_db)):
    event = get_event_or_404(db, slug, include_unpublished=_is_manager(db, request))
    return {"event": serialize_event(event)}


@router.post("/api/events")
def create_event(body: EventConfigBody, request: Request, db: Session = Depends(get_db)):
    user = require_role(db, request, [Role.ORGANIZER, Role.ADMIN])

    event = Event(
        fixture_id=new_id(),
        slug=unique_slug(db, body.name) if not body.slug else None,
        name=body.name.strip(),
        submissions_close=None,
        created_by=user.id,
    )
    db.add(event)
    apply_event_config(db, event, body)
    db.flush()
    log_action(
        db,
        actor_id=user.id,
        action="event.created",
        resource_type="event",
        resource_id=event.fixture_id,
        metadata={"name": event.name},
    )
    db.commit()
    return {"event": serialize_event(get_event_or_404(db, event.fixture_id, include_unpublished=True))}


def _update_event(event: Event, body: EventConfigBody, request: Request, db: Session) -> dict:
    user = require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    apply_event_config(db, event, body)
    log_action(
        db,
        actor_id=user.id,
        action="event.updated",
        resource_type="event",
        resource_id=event.fixture_id,
        metadata={"submissionsClose": iso(event.submissions_close)},
    )
    db.commit()
    return {"event": serialize_event(get_event_or_404(db, event.fixture_id, include_unpublished=True))}


@router.patch("/api/events/{slug}")
def update_event_by_slug(
    slug: str, body: EventConfigBody, request: Request, db: Session = Depends(get_db)
):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    event = get_event_or_404(db, slug, include_unpublished=True)
    return _update_event(event, body, request, db)


@router.patch("/api/events")
def update_default_event(body: EventConfigBody, request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    event = default_event(db)
    if not event:
        raise HTTPException(status_code=404, detail="No event to update")
    return _update_event(event, body, request, db)
