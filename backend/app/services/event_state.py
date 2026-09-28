from datetime import datetime
from enum import Enum

from app.models import Event


class EventPhase(str, Enum):
    DRAFT = "DRAFT"
    UPCOMING = "UPCOMING"
    REGISTRATION_OPEN = "REGISTRATION_OPEN"
    REGISTRATION_CLOSED = "REGISTRATION_CLOSED"
    LIVE = "LIVE"
    SUBMISSION_OPEN = "SUBMISSION_OPEN"
    SUBMISSIONS_CLOSED = "SUBMISSIONS_CLOSED"
    JUDGING = "JUDGING"
    COMPLETED = "COMPLETED"


def _now() -> datetime:
    return datetime.utcnow()


def compute_event_phase(event: Event, *, now: datetime | None = None) -> EventPhase:
    current = now or _now()

    if not getattr(event, "published", True):
        return EventPhase.DRAFT

    reg_opens = getattr(event, "registration_opens", None)
    reg_closes = getattr(event, "registration_closes", None)
    event_starts = getattr(event, "event_starts", None)
    judging_starts = getattr(event, "judging_starts", None)
    judging_ends = getattr(event, "judging_ends", None)
    results_at = getattr(event, "results_at", None)

    if reg_opens and current < reg_opens:
        return EventPhase.UPCOMING
    if reg_opens and reg_closes and reg_opens <= current < reg_closes:
        return EventPhase.REGISTRATION_OPEN
    if reg_closes and event_starts and reg_closes <= current < event_starts:
        return EventPhase.REGISTRATION_CLOSED
    if event_starts and current < event_starts:
        return EventPhase.UPCOMING

    submissions_open = current <= event.submissions_close
    if submissions_open:
        if event_starts and current >= event_starts:
            return EventPhase.SUBMISSION_OPEN
        if not event_starts:
            return EventPhase.SUBMISSION_OPEN
        return EventPhase.LIVE

    if judging_starts and judging_ends and judging_starts <= current < judging_ends:
        return EventPhase.JUDGING
    if results_at and current >= results_at:
        return EventPhase.COMPLETED
    if not submissions_open:
        return EventPhase.SUBMISSIONS_CLOSED

    return EventPhase.LIVE


def can_register(event: Event, now: datetime | None = None) -> bool:
    phase = compute_event_phase(event, now=now)
    return phase == EventPhase.REGISTRATION_OPEN


def can_submit(event: Event, now: datetime | None = None) -> bool:
    current = now or _now()
    return current <= event.submissions_close


def event_state_payload(event: Event) -> dict:
    phase = compute_event_phase(event)
    return {
        "phase": phase.value,
        "registrationOpen": can_register(event),
        "submissionsOpen": can_submit(event),
        "submissionsClose": event.submissions_close.isoformat() + "Z",
    }
