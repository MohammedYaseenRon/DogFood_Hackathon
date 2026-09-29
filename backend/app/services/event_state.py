"""Event lifecycle rules.

Every permission check that depends on the calendar (registering, forming a
team, submitting or editing a project) goes through this module so that the UI
and the API can never disagree about whether a window is open.

All datetimes are naive UTC.
"""

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


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() + "Z" if value else None


def submissions_start(event: Event) -> datetime | None:
    """When building starts. Without an explicit start, registration opening counts."""
    return event.event_starts or event.registration_opens


def compute_event_phase(event: Event, *, now: datetime | None = None) -> EventPhase:
    current = now or _now()

    if not event.published:
        return EventPhase.DRAFT

    if current > event.submissions_close:
        if event.results_at and current >= event.results_at:
            return EventPhase.COMPLETED
        if event.judging_starts and current >= event.judging_starts:
            return EventPhase.JUDGING
        return EventPhase.SUBMISSIONS_CLOSED

    start = submissions_start(event)
    if start is None or current >= start:
        return EventPhase.SUBMISSION_OPEN

    # Before hacking starts.
    if event.registration_opens and current < event.registration_opens:
        return EventPhase.UPCOMING
    if can_register(event, now=current):
        return EventPhase.REGISTRATION_OPEN
    return EventPhase.REGISTRATION_CLOSED


def can_register(event: Event, now: datetime | None = None) -> bool:
    """Registration is open inside its window and never after the deadline."""
    current = now or _now()
    if not event.published or current > event.submissions_close:
        return False
    if event.registration_opens and current < event.registration_opens:
        return False
    if event.registration_closes and current >= event.registration_closes:
        return False
    return True


def can_form_team(event: Event, now: datetime | None = None) -> bool:
    """Teams can be created or joined from registration opening until the deadline."""
    current = now or _now()
    if not event.published or current > event.submissions_close:
        return False
    if event.registration_opens and current < event.registration_opens:
        return False
    return True


def can_submit(event: Event, now: datetime | None = None) -> bool:
    """Projects can be created or edited between the event start and the deadline."""
    current = now or _now()
    if not event.published or current > event.submissions_close:
        return False
    start = submissions_start(event)
    if start and current < start:
        return False
    return True


def submission_block_reason(event: Event, now: datetime | None = None) -> str | None:
    current = now or _now()
    if not event.published:
        return "This event is not published."
    if current > event.submissions_close:
        return "Submission deadline has passed. Your project can no longer be modified."
    start = submissions_start(event)
    if start and current < start:
        return "Submissions open when the event starts."
    return None


def scoring_block_reason(event: Event, now: datetime | None = None) -> str | None:
    """Why a judge can't score right now, or None when scoring is open.

    Scoring only starts once submissions are frozen, so a judge never scores a
    project the team can still change underneath them.
    """
    current = now or _now()
    if current <= event.submissions_close:
        return "Scoring opens after the submission deadline."
    if event.judging_starts and current < event.judging_starts:
        return "Judging has not started yet."
    if event.judging_ends and current >= event.judging_ends:
        return "Judging has closed. Scores are locked."
    return None


def can_score(event: Event, now: datetime | None = None) -> bool:
    return scoring_block_reason(event, now) is None


def event_state_payload(event: Event) -> dict:
    phase = compute_event_phase(event)
    return {
        "phase": phase.value,
        "registrationOpen": can_register(event),
        "teamFormationOpen": can_form_team(event),
        "submissionsOpen": can_submit(event),
        "scoringOpen": can_score(event),
        "submissionsClose": _iso(event.submissions_close),
        "serverTime": _iso(_now()),
    }


def voting_state(config, now: datetime | None = None) -> str:
    """Community voting window: off | scheduled | open | closed."""
    current = now or _now()
    if not config or not config.enabled:
        return "off"
    if config.opens_at and current < config.opens_at:
        return "scheduled"
    if config.closes_at and current >= config.closes_at:
        return "closed"
    return "open"
