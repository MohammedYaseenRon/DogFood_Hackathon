"""Community voting endpoints.

Public:     /api/vote/{slug}/...        ballot, email verification, published results
Organizer:  /api/organizer/events/{slug}/voting/...  config, live results, voters
"""

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models import EmailCode, Role, VoteAllocation, Voter, VotingAccess, VotingMode
from app.services.audit import log_action
from app.services.events import resolve_event, serialize_event_ref
from app.services.ratelimit import fingerprint, hit, ip_key
from app.services.voting import (
    MAX_CREDITS,
    ballot_projects,
    canonical_email,
    get_config,
    issue_voter_cookie,
    load_voters,
    own_project_ids,
    resolve_voter,
    results_visible_to_public,
    serialize_config,
    serialize_voter,
    shuffled,
    tally,
    validate_allocations,
    voter_flags,
    voter_label,
    voting_state,
)

log = logging.getLogger("hackboard.voting")
router = APIRouter(tags=["voting"])

CODE_TTL = timedelta(minutes=15)
CODE_ATTEMPTS = 5


def _dev_mail() -> bool:
    """Without an email provider configured, codes are shown to the voter and
    written to the server log so the flow can be used locally."""
    return os.getenv("EMAIL_DEV_PREVIEW", "1") == "1"


def _event_and_config(db: Session, slug: str):
    event = resolve_event(db, slug)
    config = get_config(db, event)
    if not config or not config.enabled:
        raise HTTPException(status_code=404, detail="Voting is not enabled for this event")
    return event, config


# --------------------------------------------------------------------------
# Public: ballot
# --------------------------------------------------------------------------


class BallotBody(BaseModel):
    allocations: dict[str, int] = Field(default_factory=dict)
    k: str | None = Field(default=None, description="Voting link token (open-link events)")


@router.get("/api/vote/{slug}")
def get_ballot(slug: str, request: Request, response: Response, k: str | None = None, db: Session = Depends(get_db)):
    event, config = _event_and_config(db, slug)
    state = voting_state(config)
    voter, needs = resolve_voter(db, request, response, event, config, link=k, create=state == "open")
    public_results = results_visible_to_public(config)

    payload = {
        "event": serialize_event_ref(event),
        "config": serialize_config(config),
        "needs": needs,
        "voter": None,
        "projects": [],
        "allocations": {},
        "resultsAvailable": public_results,
    }
    if voter:
        projects = ballot_projects(db, event)
        own = own_project_ids(db, voter, projects)
        mine = {a.project_id: a.credits for a in voter.allocations}
        payload["voter"] = {"label": voter_label(voter), "kind": voter.kind, "voided": voter.voided}
        payload["projects"] = [
            {
                "id": p.fixture_id or p.id,
                "title": p.title,
                "tagline": p.tagline or p.summary,
                "track": p.track.name if p.track else None,
                "teamName": p.team.name,
                "thumbnailUrl": p.thumbnail_url,
                "own": p.id in own,
            }
            for p in shuffled(projects, voter)
        ]
        by_internal = {p.id: p.fixture_id or p.id for p in projects}
        payload["allocations"] = {by_internal[pid]: c for pid, c in mine.items() if pid in by_internal and c > 0}
    db.commit()
    return payload


@router.put("/api/vote/{slug}")
def save_ballot(slug: str, body: BallotBody, request: Request, response: Response, db: Session = Depends(get_db)):
    event, config = _event_and_config(db, slug)
    if voting_state(config) != "open":
        raise HTTPException(status_code=409, detail="Voting is not open")
    voter, needs = resolve_voter(db, request, response, event, config, link=body.k, create=True)
    if not voter:
        raise HTTPException(status_code=401, detail={"signin": "Sign in to vote", "email": "Verify your email to vote", "link": "Use the voting link you were given"}.get(needs or "", "Not allowed to vote"))
    if voter.voided:
        raise HTTPException(status_code=403, detail="This ballot was voided by the organizers")
    hit(db, f"vote:save:{voter.id}", limit=30, window=timedelta(minutes=10), message="You're saving too often. Wait a minute and try again.")

    projects = ballot_projects(db, event)
    by_public = {p.fixture_id or p.id: p for p in projects}
    own = {p.fixture_id or p.id for p in projects if p.id in own_project_ids(db, voter, projects)}
    clean = validate_allocations(body.allocations, config=config, allowed=set(by_public), own=own)

    positions = {p.id: index for index, p in enumerate(shuffled(projects, voter), start=1)}
    existing = {a.project_id: a for a in voter.allocations}
    wanted = {by_public[pid].id: credits for pid, credits in clean.items()}
    for project_id, allocation in existing.items():
        if project_id not in wanted:
            db.delete(allocation)
    for project_id, credits in wanted.items():
        allocation = existing.get(project_id)
        if allocation:
            allocation.credits = credits
        else:
            db.add(
                VoteAllocation(
                    voter_id=voter.id,
                    project_id=project_id,
                    credits=credits,
                    shown_position=positions.get(project_id),
                )
            )

    log_action(
        db,
        actor_id=voter.user_id,
        action="vote.cast",
        resource_type="voter",
        resource_id=voter.id,
        metadata={"voter": voter_label(voter), "projects": len(clean), "spent": sum(clean.values())},
        event_id=event.id,
    )
    db.commit()
    return {"ok": True, "allocations": clean, "spent": sum(clean.values()), "credits": config.credits}


# --------------------------------------------------------------------------
# Public: email verification
# --------------------------------------------------------------------------


class EmailStart(BaseModel):
    email: str = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def _valid(cls, value: str) -> str:
        value = value.strip()
        if "@" not in value or " " in value or "." not in value.partition("@")[2]:
            raise ValueError("Enter a valid email address")
        return value


class EmailVerify(EmailStart):
    code: str = Field(min_length=6, max_length=6)


def _code_hash(code: str, email: str) -> str:
    return hashlib.sha256(f"{email}:{code}".encode()).hexdigest()


@router.post("/api/vote/{slug}/email/start")
def start_email(slug: str, body: EmailStart, request: Request, db: Session = Depends(get_db)):
    event, config = _event_and_config(db, slug)
    if config.access != VotingAccess.EMAIL:
        raise HTTPException(status_code=400, detail="This event doesn't use email voting")
    if voting_state(config) != "open":
        raise HTTPException(status_code=409, detail="Voting is not open")
    email = canonical_email(body.email)
    hit(db, f"vote:email:ip:{ip_key(request)}", limit=10, window=timedelta(hours=1),
        message="Too many codes requested from this network. Try again later.")
    hit(db, f"vote:email:addr:{event.id}:{email}", limit=3, window=timedelta(minutes=15),
        message="A code was just sent to this address. Check your inbox or wait a few minutes.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        EmailCode(
            event_id=event.id,
            email=email,
            email_display=body.email.strip().lower(),
            code_hash=_code_hash(code, email),
            expires_at=datetime.utcnow() + CODE_TTL,
        )
    )
    db.commit()
    log.info("voting code for %s (%s): %s", body.email, event.slug, code)
    payload = {"ok": True, "expiresInMinutes": int(CODE_TTL.total_seconds() // 60)}
    if _dev_mail():
        payload["devCode"] = code
    return payload


@router.post("/api/vote/{slug}/email/verify")
def verify_email(slug: str, body: EmailVerify, request: Request, response: Response, db: Session = Depends(get_db)):
    event, config = _event_and_config(db, slug)
    if config.access != VotingAccess.EMAIL:
        raise HTTPException(status_code=400, detail="This event doesn't use email voting")
    email = canonical_email(body.email)
    record = (
        db.query(EmailCode)
        .filter(EmailCode.event_id == event.id, EmailCode.email == email, EmailCode.consumed_at.is_(None))
        .order_by(EmailCode.created_at.desc())
        .first()
    )
    if not record or record.expires_at < datetime.utcnow() or record.attempts >= CODE_ATTEMPTS:
        raise HTTPException(status_code=400, detail="That code has expired. Request a new one.")
    if not secrets.compare_digest(record.code_hash, _code_hash(body.code, email)):
        record.attempts += 1
        db.commit()
        left = CODE_ATTEMPTS - record.attempts
        raise HTTPException(status_code=400, detail=f"Wrong code. {left} attempt{'s' if left != 1 else ''} left.")
    record.consumed_at = datetime.utcnow()

    voter = db.query(Voter).filter(Voter.event_id == event.id, Voter.email == email).first()
    if not voter:
        voter = Voter(event_id=event.id, kind="email", email=email, email_display=record.email_display,
                      fingerprint=fingerprint(request, event.id))
        db.add(voter)
        db.flush()
    issue_voter_cookie(response, event, voter)
    log_action(db, actor_id=None, action="vote.email_verified", resource_type="voter", resource_id=voter.id,
               metadata={"voter": voter_label(voter)}, event_id=event.id)
    db.commit()
    return {"ok": True}


# --------------------------------------------------------------------------
# Public: results (only once closed and published)
# --------------------------------------------------------------------------


@router.get("/api/vote/{slug}/results")
def public_results(slug: str, db: Session = Depends(get_db)):
    event, config = _event_and_config(db, slug)
    if not results_visible_to_public(config):
        state = voting_state(config)
        detail = (
            "Results are hidden while voting is open."
            if state in ("open", "scheduled")
            else "The organizers haven't published the results yet."
        )
        raise HTTPException(status_code=403, detail=detail)
    data = tally(db, event, config)
    return {
        "event": serialize_event_ref(event),
        "config": data["config"],
        "projects": [
            {k: row[k] for k in ("rank", "projectId", "title", "teamName", "track", "score", "supporters")}
            for row in data["projects"]
            if row["rank"]
        ],
        "ballots": data["ballots"]["counted"],
    }


# --------------------------------------------------------------------------
# Organizer
# --------------------------------------------------------------------------


class ConfigBody(BaseModel):
    enabled: bool
    access: VotingAccess
    mode: VotingMode
    credits: int = Field(ge=1, le=MAX_CREDITS)
    opens_at: datetime | None = Field(default=None, alias="opensAt")
    closes_at: datetime | None = Field(default=None, alias="closesAt")
    results_published: bool = Field(default=False, alias="resultsPublished")

    model_config = {"populate_by_name": True}


def _naive(value: datetime | None) -> datetime | None:
    """Store naive UTC, like every other timestamp in the schema."""
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


class VoidBody(BaseModel):
    voided: bool
    reason: str | None = Field(default=None, max_length=300)


org = APIRouter(prefix="/api/organizer/events/{slug}/voting", tags=["voting"])


def _manager(db: Session, request: Request):
    return require_role(db, request, [Role.ORGANIZER, Role.ADMIN])


@org.get("")
def voting_admin(slug: str, request: Request, db: Session = Depends(get_db)):
    _manager(db, request)
    event = resolve_event(db, slug)
    config = get_config(db, event, create=True)
    db.commit()
    return {"event": serialize_event_ref(event), "config": serialize_config(config, include_secret=True)}


@org.put("")
def update_voting(slug: str, body: ConfigBody, request: Request, db: Session = Depends(get_db)):
    user = _manager(db, request)
    event = resolve_event(db, slug)
    config = get_config(db, event, create=True)
    opens, closes = _naive(body.opens_at), _naive(body.closes_at)
    if opens and closes and closes <= opens:
        raise HTTPException(status_code=400, detail="Voting must close after it opens")
    if body.results_published and voting_state(config) != "closed" and not (closes and closes <= datetime.utcnow()):
        raise HTTPException(status_code=400, detail="Results can only be published after voting closes")
    has_ballots = (
        db.query(VoteAllocation.id).join(VoteAllocation.voter).filter(Voter.event_id == event.id).first()
        is not None
    )
    if has_ballots and (body.mode != config.mode or body.credits != config.credits):
        raise HTTPException(
            status_code=409,
            detail="Ballots have been cast, so the voting mode and budget are locked.",
        )

    before = serialize_config(config)
    config.enabled = body.enabled
    config.access = body.access
    config.mode = body.mode
    config.credits = body.credits
    config.opens_at = opens
    config.closes_at = closes
    config.results_published = body.results_published
    after = serialize_config(config)
    changed = {k: {"from": before[k], "to": after[k]} for k in after if before[k] != after[k] and k != "state"}
    log_action(db, actor_id=user.id, action="voting.configured", resource_type="event",
               resource_id=event.fixture_id, metadata=changed, event_id=event.id)
    db.commit()
    return {"config": serialize_config(config, include_secret=True)}


@org.post("/rotate-link")
def rotate_link(slug: str, request: Request, db: Session = Depends(get_db)):
    user = _manager(db, request)
    event = resolve_event(db, slug)
    config = get_config(db, event, create=True)
    config.link_token = secrets.token_urlsafe(16)
    log_action(db, actor_id=user.id, action="voting.link_rotated", resource_type="event",
               resource_id=event.fixture_id, event_id=event.id)
    db.commit()
    return {"config": serialize_config(config, include_secret=True)}


@org.get("/results")
def organizer_results(slug: str, request: Request, db: Session = Depends(get_db)):
    """Live tallies: organizers only, at any time."""
    _manager(db, request)
    event = resolve_event(db, slug)
    config = get_config(db, event, create=True)
    db.commit()
    return {"event": serialize_event_ref(event), **tally(db, event, config)}


@org.get("/voters")
def list_voters(slug: str, request: Request, flagged: bool = False, db: Session = Depends(get_db)):
    _manager(db, request)
    event = resolve_event(db, slug)
    voters = load_voters(db, event)
    flags = voter_flags(db, event, voters)
    rows = [serialize_voter(v, flags.get(v.id, [])) for v in voters]
    if flagged:
        rows = [r for r in rows if r["flags"] or r["voided"]]
    rows.sort(key=lambda r: (not r["flags"], r["voided"], r["createdAt"] or ""), reverse=False)
    return {"voters": rows}


@org.post("/voters/{voter_id}/void")
def void_voter(slug: str, voter_id: str, body: VoidBody, request: Request, db: Session = Depends(get_db)):
    user = _manager(db, request)
    event = resolve_event(db, slug)
    voter = db.query(Voter).filter(Voter.id == voter_id, Voter.event_id == event.id).first()
    if not voter:
        raise HTTPException(status_code=404, detail="Ballot not found")
    if body.voided and not (body.reason or "").strip():
        raise HTTPException(status_code=400, detail="Give a reason for voiding a ballot")
    voter.voided = body.voided
    voter.void_reason = (body.reason or "").strip() or None if body.voided else None
    voter.voided_by = user.id if body.voided else None
    voter.voided_at = datetime.utcnow() if body.voided else None
    log_action(db, actor_id=user.id, action="vote.voided" if body.voided else "vote.restored",
               resource_type="voter", resource_id=voter.id,
               metadata={"voter": voter_label(voter), "reason": voter.void_reason}, event_id=event.id)
    db.commit()
    return {"ok": True}


router.include_router(org)
