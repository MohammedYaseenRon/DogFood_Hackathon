"""Accepting a judge invitation."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import get_session_user, require_user
from app.database import get_db
from app.models import EventRegistration, JudgeInvite, Role, TeamMember, Team, Track
from app.services.audit import log_action
from app.services.events import iso, serialize_event_ref
from app.services.judging import panel_seat, seat_on_panel

router = APIRouter(prefix="/api/judge-invites", tags=["judging"])


def _mask(email: str) -> str:
    name, _, domain = email.partition("@")
    return f"{name[:1]}{'•' * max(len(name) - 1, 1)}@{domain}"


def _usable_invite(db: Session, token: str) -> JudgeInvite:
    invite = db.query(JudgeInvite).filter(JudgeInvite.token == token).first()
    if not invite or invite.revoked:
        raise HTTPException(status_code=404, detail="This invite link is not valid")
    if invite.accepted_by:
        raise HTTPException(status_code=410, detail="This invite link has already been used")
    if invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="This invite link has expired")
    return invite


@router.get("/{token}")
def preview_invite(token: str, request: Request, db: Session = Depends(get_db)):
    invite = _usable_invite(db, token)
    event = invite.event
    tracks = [t.name for t in event.tracks if t.fixture_id in (invite.track_ids or [])]
    user = get_session_user(db, request)
    return {
        "event": serialize_event_ref(event),
        "tracks": tracks,
        "allTracks": not tracks,
        # Masked so a leaked link doesn't also leak who it was meant for.
        "email": _mask(invite.email) if invite.email else None,
        "expiresAt": iso(invite.expires_at),
        "alreadyJudge": bool(user and panel_seat(db, event.id, user.id)),
    }


@router.post("/{token}/accept")
def accept_invite(token: str, request: Request, db: Session = Depends(get_db)):
    user = require_user(db, request)
    invite = _usable_invite(db, token)
    event = invite.event

    if invite.email and invite.email != user.email.lower():
        raise HTTPException(status_code=403, detail="This invite was sent to a different email address")
    if user.role in (Role.ORGANIZER, Role.ADMIN):
        raise HTTPException(
            status_code=409,
            detail="Organizer and admin accounts run judging; accept this invite with a judge account.",
        )
    if user.role == Role.PARTICIPANT:
        raise HTTPException(
            status_code=409,
            detail="Participant accounts can't judge. Accept this invite with a separate account.",
        )
    # A visitor who registered for or joined a team in this event has a stake in it.
    competing = (
        db.query(EventRegistration.id)
        .filter(EventRegistration.event_id == event.id, EventRegistration.user_id == user.id)
        .first()
        or db.query(TeamMember.id)
        .join(Team, Team.id == TeamMember.team_id)
        .filter(Team.event_id == event.id, TeamMember.user_id == user.id)
        .first()
    )
    if competing:
        raise HTTPException(status_code=409, detail="You are competing in this event, so you can't judge it.")

    track_ids = [
        t.id
        for t in db.query(Track).filter(Track.event_id == event.id, Track.fixture_id.in_(invite.track_ids or [""]))
    ]
    if user.role == Role.VISITOR:
        user.role = Role.JUDGE
    seat_on_panel(db, event, user, track_ids, invite.created_by)
    invite.accepted_by = user.id
    invite.accepted_at = datetime.utcnow()
    log_action(
        db,
        actor_id=user.id,
        action="judge.invite_accepted",
        resource_type="event",
        resource_id=event.fixture_id,
        metadata={"tracks": invite.track_ids or []},
    )
    db.commit()
    return {"ok": True, "event": serialize_event_ref(event)}
