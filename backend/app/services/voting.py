"""Community voting: configuration, voter identity, ballots, tallies and
duplicate detection. See VOTING.md for the reasoning behind each rule."""

from __future__ import annotations

import hashlib
import math
import random
import re
import secrets
from collections import Counter, defaultdict
from datetime import timedelta

from fastapi import HTTPException, Request, Response
from sqlalchemy.orm import Session, joinedload

from app.auth import get_session_user
from app.models import (
    Event,
    Project,
    ProjectStatus,
    Team,
    TeamMember,
    User,
    Voter,
    VotingAccess,
    VotingConfig,
    VotingMode,
    new_id,
)
from app.services.event_state import voting_state
from app.services.events import iso
from app.services.judging import duplicate_map
from app.services.ratelimit import fingerprint, hit, ip_key

MAX_CREDITS = 100
VOTER_COOKIE_DAYS = 30
SHARED_DEVICE_THRESHOLD = 3  # this many voters on one device fingerprint is suspicious
BURST_WINDOW = timedelta(minutes=10)
FRESH_ACCOUNT = timedelta(hours=1)

# --------------------------------------------------------------------------
# Configuration and window
# --------------------------------------------------------------------------


def get_config(db: Session, event: Event, *, create: bool = False) -> VotingConfig | None:
    config = db.query(VotingConfig).filter(VotingConfig.event_id == event.id).first()
    if not config and create:
        config = VotingConfig(event_id=event.id, link_token=secrets.token_urlsafe(16))
        db.add(config)
        db.flush()
    return config


def results_visible_to_public(config: VotingConfig | None) -> bool:
    """Results stay hidden from everyone but organizers until the window has
    closed *and* an organizer has chosen to publish them."""
    return bool(config and voting_state(config) == "closed" and config.results_published)


def serialize_config(config: VotingConfig, *, include_secret: bool = False) -> dict:
    payload = {
        "enabled": config.enabled,
        "access": config.access.value,
        "mode": config.mode.value,
        "credits": config.credits,
        "opensAt": iso(config.opens_at),
        "closesAt": iso(config.closes_at),
        "state": voting_state(config),
        "resultsPublished": config.results_published,
    }
    if include_secret:
        payload["linkToken"] = config.link_token
    return payload


# --------------------------------------------------------------------------
# Voter identity
# --------------------------------------------------------------------------


def canonical_email(value: str) -> str:
    """Collapse aliases that reach the same inbox: case, +tags, and dots in
    Gmail local parts. Two spellings of one inbox become one voter."""
    local, _, domain = value.strip().lower().partition("@")
    local = local.split("+", 1)[0]
    if domain in {"gmail.com", "googlemail.com"}:
        local = local.replace(".", "")
        domain = "gmail.com"
    return f"{local}@{domain}"


def cookie_name(event: Event) -> str:
    return f"dfv_{re.sub(r'[^a-zA-Z0-9]', '', event.fixture_id)}"


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def issue_voter_cookie(response: Response, event: Event, voter: Voter) -> None:
    raw = secrets.token_urlsafe(32)
    voter.session_hash = _hash(raw)
    response.set_cookie(
        cookie_name(event),
        raw,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=VOTER_COOKIE_DAYS * 24 * 3600,
    )


def voter_from_cookie(db: Session, request: Request, event: Event) -> Voter | None:
    raw = request.cookies.get(cookie_name(event))
    if not raw:
        return None
    return (
        db.query(Voter)
        .filter(Voter.event_id == event.id, Voter.session_hash == _hash(raw))
        .first()
    )


def voter_label(voter: Voter) -> str:
    if voter.kind == "user" and voter.user:
        return voter.user.name or voter.user.email
    if voter.kind == "email" and voter.email_display:
        name, _, domain = voter.email_display.partition("@")
        return f"{name[:2]}•••@{domain}"
    return f"Anonymous {voter.id[:6]}"


def resolve_voter(
    db: Session,
    request: Request,
    response: Response | None,
    event: Event,
    config: VotingConfig,
    *,
    link: str | None,
    create: bool,
) -> tuple[Voter | None, str | None]:
    """The caller's voter record for this event and, if there is none, what
    they still need to do: "signin", "email" or "link"."""
    scope = event.id
    if config.access == VotingAccess.AUTHENTICATED:
        user = get_session_user(db, request)
        if not user:
            return None, "signin"
        voter = db.query(Voter).filter(Voter.event_id == event.id, Voter.user_id == user.id).first()
        if not voter and create:
            voter = Voter(
                event_id=event.id,
                kind="user",
                user_id=user.id,
                fingerprint=fingerprint(request, scope),
                ballot_seed=new_id(),
            )
            db.add(voter)
            db.flush()
        return voter, None

    voter = voter_from_cookie(db, request, event)
    if config.access == VotingAccess.EMAIL:
        if voter and voter.kind == "email":
            return voter, None
        return None, "email"

    # Open link: holding the secret link is the credential.
    if voter and voter.kind == "anon":
        return voter, None
    if not link or not secrets.compare_digest(link, config.link_token):
        return None, "link"
    if not create or response is None:
        return None, None
    hit(
        db,
        f"vote:newvoter:{event.id}:{ip_key(request)}",
        limit=5,
        window=timedelta(hours=1),
        message="Too many new ballots from this network. Try again later.",
    )
    voter = Voter(
        event_id=event.id,
        kind="anon",
        fingerprint=fingerprint(request, scope),
        ballot_seed=new_id(),
    )
    db.add(voter)
    db.flush()
    issue_voter_cookie(response, event, voter)
    return voter, None


# --------------------------------------------------------------------------
# Ballot
# --------------------------------------------------------------------------


def ballot_projects(db: Session, event: Event) -> list[Project]:
    """Submitted projects, minus superseded duplicates, in a stable base order."""
    projects = (
        db.query(Project)
        .options(joinedload(Project.track), joinedload(Project.team))
        .join(Project.team)
        .filter(Team.event_id == event.id, Project.status == ProjectStatus.SUBMITTED)
        .all()
    )
    dropped = duplicate_map(projects)
    return sorted((p for p in projects if p.id not in dropped), key=lambda p: p.id)


def shuffled(projects: list[Project], voter: Voter) -> list[Project]:
    """Each voter gets their own random order (stable across reloads), so no
    project systematically benefits from being listed first."""
    order = list(projects)
    random.Random(f"{voter.ballot_seed}:{voter.event_id}").shuffle(order)
    return order


def own_project_ids(db: Session, voter: Voter, projects: list[Project]) -> set[str]:
    """Projects the voter can't vote for because they're on the team."""
    user_ids: set[str] = set()
    if voter.user_id:
        user_ids.add(voter.user_id)
    if voter.email:
        # Accounts are stored by plain lowercase email; compare canonical forms
        # so voting as jane+x@ still counts as Jane's own team.
        domain = voter.email.partition("@")[2]
        candidates = db.query(User.id, User.email).filter(User.email.like(f"%@{domain}"))
        user_ids.update(u.id for u in candidates if canonical_email(u.email) == voter.email)
    if not user_ids:
        return set()
    team_ids = {
        row.team_id for row in db.query(TeamMember.team_id).filter(TeamMember.user_id.in_(user_ids))
    }
    return {p.id for p in projects if p.team_id in team_ids}


def influence(credits: int, mode: VotingMode) -> float:
    if credits <= 0:
        return 0.0
    return math.sqrt(credits) if mode == VotingMode.QUADRATIC else 1.0


def validate_allocations(
    allocations: dict[str, int],
    *,
    config: VotingConfig,
    allowed: set[str],
    own: set[str],
) -> dict[str, int]:
    clean: dict[str, int] = {}
    for project_id, value in allocations.items():
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise HTTPException(status_code=400, detail="Votes must be whole numbers of zero or more")
        if value == 0:
            continue
        if project_id not in allowed:
            raise HTTPException(status_code=400, detail="That project is not on this ballot")
        if project_id in own:
            raise HTTPException(status_code=403, detail="You can't vote for your own team's project")
        if config.mode == VotingMode.SIMPLE and value > 1:
            raise HTTPException(status_code=400, detail="Each project takes at most one vote")
        clean[project_id] = value
    spent = sum(clean.values())
    if spent > config.credits:
        noun = "credits" if config.mode == VotingMode.QUADRATIC else "votes"
        raise HTTPException(
            status_code=400, detail=f"You spent {spent} {noun} but only have {config.credits}"
        )
    return clean


# --------------------------------------------------------------------------
# Tally and abuse signals
# --------------------------------------------------------------------------


def voter_flags(db: Session, event: Event, voters: list[Voter]) -> dict[str, list[str]]:
    """Signals an organizer should look at. Nothing is voided automatically:
    shared networks (a campus, a conference Wi-Fi) are legitimate."""
    flags: dict[str, list[str]] = defaultdict(list)
    by_fp: dict[str, list[Voter]] = defaultdict(list)
    for voter in voters:
        by_fp[voter.fingerprint].append(voter)

    for group in by_fp.values():
        if len(group) >= SHARED_DEVICE_THRESHOLD:
            for voter in group:
                flags[voter.id].append(f"same device as {len(group) - 1} other voters")
        times = sorted(v.created_at for v in group)
        for voter in group:
            nearby = sum(1 for t in times if abs((t - voter.created_at).total_seconds()) <= BURST_WINDOW.total_seconds())
            if nearby >= SHARED_DEVICE_THRESHOLD and voter.kind != "user":
                flags[voter.id].append("burst of new ballots from one device")

    signatures: dict[str, list[str]] = defaultdict(list)
    for voter in voters:
        ballot = tuple(sorted((a.project_id, a.credits) for a in voter.allocations if a.credits > 0))
        if len(ballot) >= 2:
            signatures[repr(ballot)].append(voter.id)
    for ids in signatures.values():
        if len(ids) >= 3:
            for voter_id in ids:
                flags[voter_id].append(f"identical ballot to {len(ids) - 1} others")

    for voter in voters:
        if voter.kind == "user" and voter.user and voter.user.created_at:
            if voter.created_at - voter.user.created_at < FRESH_ACCOUNT:
                flags[voter.id].append("account created just before voting")

    for voter_id in flags:
        flags[voter_id] = list(dict.fromkeys(flags[voter_id]))
    return flags


def load_voters(db: Session, event: Event) -> list[Voter]:
    return (
        db.query(Voter)
        .options(joinedload(Voter.allocations), joinedload(Voter.user))
        .filter(Voter.event_id == event.id)
        .all()
    )


def tally(db: Session, event: Event, config: VotingConfig) -> dict:
    projects = ballot_projects(db, event)
    voters = load_voters(db, event)
    flags = voter_flags(db, event, voters)
    counted = [v for v in voters if not v.voided and any(a.credits > 0 for a in v.allocations)]

    score: dict[str, float] = defaultdict(float)
    credits: dict[str, int] = defaultdict(int)
    supporters: dict[str, int] = defaultdict(int)
    positions: dict[str, list[int]] = defaultdict(list)
    for voter in counted:
        for allocation in voter.allocations:
            if allocation.credits <= 0:
                continue
            score[allocation.project_id] += influence(allocation.credits, config.mode)
            credits[allocation.project_id] += allocation.credits
            supporters[allocation.project_id] += 1
            if allocation.shown_position is not None:
                positions[allocation.project_id].append(allocation.shown_position)

    rows = [
        {
            "projectId": p.fixture_id or p.id,
            "title": p.title,
            "teamName": p.team.name,
            "track": p.track.name if p.track else None,
            "score": round(score[p.id], 3),
            "credits": credits[p.id],
            "supporters": supporters[p.id],
            "avgPosition": round(sum(positions[p.id]) / len(positions[p.id]), 1) if positions[p.id] else None,
        }
        for p in projects
    ]
    rows.sort(key=lambda r: (-r["score"], -r["supporters"], r["title"]))
    rank, previous = 0, None
    for index, row in enumerate(rows, start=1):
        key = (row["score"], row["supporters"])
        if key != previous:
            rank, previous = index, key
        row["rank"] = rank if row["score"] > 0 else None

    # What one-person-one-vote would have said, for comparison.
    head_count = sorted(rows, key=lambda r: (-r["supporters"], r["title"]))
    for index, row in enumerate(head_count, start=1):
        row["headcountRank"] = index if row["supporters"] else None

    flagged = [v for v in voters if flags.get(v.id)]
    return {
        "config": serialize_config(config),
        "projects": rows,
        "ballots": {
            "total": len(voters),
            "counted": len(counted),
            "voided": sum(1 for v in voters if v.voided),
            "flagged": len(flagged),
            "empty": sum(1 for v in voters if not any(a.credits > 0 for a in v.allocations)),
        },
        "ballotSize": len(projects),
        "kinds": dict(Counter(v.kind for v in voters)),
    }


def serialize_voter(voter: Voter, flags: list[str]) -> dict:
    allocations = [a for a in voter.allocations if a.credits > 0]
    return {
        "id": voter.id,
        "label": voter_label(voter),
        "kind": voter.kind,
        "createdAt": iso(voter.created_at),
        "projects": len(allocations),
        "creditsSpent": sum(a.credits for a in allocations),
        "fingerprint": voter.fingerprint[:8],
        "flags": flags,
        "voided": voter.voided,
        "voidReason": voter.void_reason,
    }
