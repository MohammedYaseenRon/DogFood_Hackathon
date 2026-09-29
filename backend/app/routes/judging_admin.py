"""Organizer judging operations for one event: the judge panel and its invites,
assignment (by batch or automatically), the rubric, live progress and results."""

import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role
from app.config import app_base_url
from app.database import get_db
from app.models import (
    Event,
    EventJudge,
    JudgeAssignment,
    JudgeInvite,
    Project,
    Role,
    RubricCriterion,
    Score,
    Team,
    User,
)
from app.services.audit import log_action
from app.services.event_state import scoring_block_reason
from app.services.events import iso, resolve_event, serialize_event_ref
from app.services.judging import (
    create_assignment,
    duplicate_map,
    event_has_scores,
    event_progress,
    event_projects,
    event_results,
    event_rubric,
    ineligible_reason,
    panel,
    panel_seat,
    plan_auto_assignment,
    resolve_tracks,
    seat_on_panel,
    serialize_criterion,
    set_seat_tracks,
)

router = APIRouter(prefix="/api/organizer/events/{slug}", tags=["judging"])

MAX_CRITERIA = 10


def _manager(db: Session, request: Request) -> User:
    return require_role(db, request, [Role.ORGANIZER, Role.ADMIN])


def _project(db: Session, event: Event, ref: str) -> Project:
    project = (
        db.query(Project)
        .options(joinedload(Project.team), joinedload(Project.track))
        .join(Project.team)
        .filter(Team.event_id == event.id)
        .filter((Project.fixture_id == ref) | (Project.id == ref))
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {ref} is not in this event")
    return project


def _judge_user(db: Session, ref: str) -> User | None:
    return db.query(User).filter((User.fixture_id == ref) | (User.id == ref) | (User.email == ref)).first()


def _seat_or_404(db: Session, event: Event, ref: str) -> EventJudge:
    user = _judge_user(db, ref)
    seat = panel_seat(db, event.id, user.id) if user else None
    if not seat:
        raise HTTPException(status_code=404, detail="Judge is not on this event's panel")
    return seat


def invite_url(token: str) -> str:
    return f"{app_base_url()}/judge-invite/{token}"


def serialize_invite(invite: JudgeInvite, event: Event) -> dict:
    names = {t.fixture_id: t.name for t in event.tracks}
    ids = invite.track_ids or []
    return {
        "id": invite.id,
        "token": invite.token,
        "url": invite_url(invite.token),
        "email": invite.email,
        "trackIds": ids,
        "tracks": [names.get(t, t) for t in ids],
        "expiresAt": iso(invite.expires_at),
        "expired": invite.expires_at < datetime.utcnow(),
        "createdAt": iso(invite.created_at),
    }


# --------------------------------------------------------------------------
# Overview
# --------------------------------------------------------------------------


@router.get("/judging")
def judging_overview(slug: str, request: Request, db: Session = Depends(get_db)):
    _manager(db, request)
    event = resolve_event(db, slug)
    reason = scoring_block_reason(event)
    return {
        "event": serialize_event_ref(event),
        "tracks": [{"id": t.fixture_id, "name": t.name} for t in event.tracks if t.active],
        "scoringOpen": reason is None,
        "scoringBlockReason": reason,
        "rubric": [serialize_criterion(c) for c in event_rubric(db, event.id)],
        "rubricLocked": event_has_scores(db, event),
        "progress": event_progress(db, event),
    }


@router.get("/judging/progress")
def judging_progress(slug: str, request: Request, db: Session = Depends(get_db)):
    _manager(db, request)
    return event_progress(db, resolve_event(db, slug))


# --------------------------------------------------------------------------
# Panel and invites
# --------------------------------------------------------------------------


class InviteBody(BaseModel):
    email: str | None = Field(default=None, max_length=254)
    track_ids: list[str] = Field(default_factory=list, alias="trackIds")
    expires_in_days: int = Field(default=14, ge=1, le=90, alias="expiresInDays")

    model_config = {"populate_by_name": True}

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        value = (value or "").strip().lower()
        if not value:
            return None
        if "@" not in value or " " in value:
            raise ValueError("Enter a valid email address")
        return value


class SeatBody(BaseModel):
    email: str = Field(max_length=254)
    track_ids: list[str] = Field(default_factory=list, alias="trackIds")

    model_config = {"populate_by_name": True}


class ScopeBody(BaseModel):
    track_ids: list[str] = Field(default_factory=list, alias="trackIds")

    model_config = {"populate_by_name": True}


@router.get("/judges")
def list_judges(slug: str, request: Request, db: Session = Depends(get_db)):
    _manager(db, request)
    event = resolve_event(db, slug)
    invites = (
        db.query(JudgeInvite)
        .filter(
            JudgeInvite.event_id == event.id,
            JudgeInvite.revoked.is_(False),
            JudgeInvite.accepted_by.is_(None),
        )
        .order_by(JudgeInvite.created_at.desc())
        .all()
    )
    return {
        "judges": event_progress(db, event)["judges"],
        "invites": [serialize_invite(i, event) for i in invites],
    }


@router.post("/judges/invites", status_code=201)
def create_judge_invite(slug: str, body: InviteBody, request: Request, db: Session = Depends(get_db)):
    user = _manager(db, request)
    event = resolve_event(db, slug)
    tracks = resolve_tracks(db, event, body.track_ids)
    invite = JudgeInvite(
        event_id=event.id,
        token=secrets.token_urlsafe(32),
        email=body.email,
        track_ids=[t.fixture_id for t in tracks],
        created_by=user.id,
        expires_at=datetime.utcnow() + timedelta(days=body.expires_in_days),
    )
    db.add(invite)
    log_action(
        db,
        actor_id=user.id,
        action="judge.invited",
        resource_type="event",
        resource_id=event.fixture_id,
        metadata={"email": body.email, "tracks": invite.track_ids},
    )
    db.commit()
    db.refresh(invite)
    return serialize_invite(invite, event)


@router.delete("/judges/invites/{invite_id}")
def revoke_judge_invite(slug: str, invite_id: str, request: Request, db: Session = Depends(get_db)):
    user = _manager(db, request)
    event = resolve_event(db, slug)
    invite = db.query(JudgeInvite).filter(JudgeInvite.id == invite_id, JudgeInvite.event_id == event.id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    invite.revoked = True
    log_action(db, actor_id=user.id, action="judge.invite_revoked", resource_type="event", resource_id=event.fixture_id)
    db.commit()
    return {"ok": True}


@router.post("/judges", status_code=201)
def add_existing_judge(slug: str, body: SeatBody, request: Request, db: Session = Depends(get_db)):
    """Seat an existing judge account directly (no invite round-trip)."""
    actor = _manager(db, request)
    event = resolve_event(db, slug)
    judge = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if not judge:
        raise HTTPException(status_code=404, detail="No account with that email. Send an invite link instead.")
    if judge.role != Role.JUDGE:
        raise HTTPException(
            status_code=409,
            detail=f"That account is a {judge.role.value.lower()}. Send an invite link instead.",
        )
    tracks = resolve_tracks(db, event, body.track_ids)
    seat_on_panel(db, event, judge, [t.id for t in tracks], actor.id)
    log_action(
        db,
        actor_id=actor.id,
        action="judge.seated",
        resource_type="event",
        resource_id=event.fixture_id,
        metadata={"judge": judge.email, "tracks": [t.fixture_id for t in tracks]},
    )
    db.commit()
    return {"ok": True}


@router.patch("/judges/{judge_ref}")
def update_judge_scope(
    slug: str, judge_ref: str, body: ScopeBody, request: Request, db: Session = Depends(get_db)
):
    """Change a judge's tracks. Unscored assignments that fall outside the new
    scope are withdrawn; narrowing away from tracks they already scored is
    refused so no score silently disappears from the judge's view."""
    actor = _manager(db, request)
    event = resolve_event(db, slug)
    seat = _seat_or_404(db, event, judge_ref)
    tracks = resolve_tracks(db, event, body.track_ids)
    new_scope = {t.id for t in tracks}

    def outside(project: Project) -> bool:
        return bool(new_scope) and project.track_id not in new_scope

    assignments = (
        db.query(JudgeAssignment)
        .options(joinedload(JudgeAssignment.project))
        .join(JudgeAssignment.project)
        .join(Project.team)
        .filter(JudgeAssignment.judge_id == seat.user_id, Team.event_id == event.id)
        .all()
    )
    scored = {s.project_id for s in db.query(Score.project_id).filter(Score.judge_id == seat.user_id)}
    blocked = [a.project.title for a in assignments if outside(a.project) and a.project_id in scored]
    if blocked:
        raise HTTPException(
            status_code=409,
            detail="This judge already scored projects outside those tracks: " + ", ".join(sorted(blocked)[:5]),
        )
    withdrawn = 0
    for assignment in assignments:
        if outside(assignment.project):
            db.delete(assignment)
            withdrawn += 1

    set_seat_tracks(db, seat, list(new_scope))
    log_action(
        db,
        actor_id=actor.id,
        action="judge.scope_changed",
        resource_type="event",
        resource_id=event.fixture_id,
        metadata={"judge": seat.user_id, "tracks": [t.fixture_id for t in tracks], "withdrawn": withdrawn},
    )
    db.commit()
    return {"ok": True, "withdrawn": withdrawn}


@router.delete("/judges/{judge_ref}")
def remove_judge(slug: str, judge_ref: str, request: Request, db: Session = Depends(get_db)):
    actor = _manager(db, request)
    event = resolve_event(db, slug)
    seat = _seat_or_404(db, event, judge_ref)
    project_ids = [p.id for p in event_projects(db, event, submitted_only=False)]
    has_scores = (
        db.query(Score.id)
        .filter(Score.judge_id == seat.user_id, Score.project_id.in_(project_ids or [""]))
        .first()
    )
    if has_scores:
        raise HTTPException(
            status_code=409,
            detail="This judge has already scored projects. Narrow their tracks or leave them on the panel.",
        )
    removed = (
        db.query(JudgeAssignment)
        .filter(JudgeAssignment.judge_id == seat.user_id, JudgeAssignment.project_id.in_(project_ids or [""]))
        .delete(synchronize_session=False)
    )
    db.delete(seat)
    log_action(
        db,
        actor_id=actor.id,
        action="judge.removed",
        resource_type="event",
        resource_id=event.fixture_id,
        metadata={"judge": seat.user_id, "assignmentsWithdrawn": removed},
    )
    db.commit()
    return {"ok": True}


# --------------------------------------------------------------------------
# Assignments
# --------------------------------------------------------------------------


class BatchBody(BaseModel):
    judge_ids: list[str] = Field(alias="judgeIds", min_length=1)
    project_ids: list[str] = Field(alias="projectIds", min_length=1)
    batch: str | None = Field(default=None, max_length=80)

    model_config = {"populate_by_name": True}


class AutoBody(BaseModel):
    reviews_per_project: int = Field(default=3, ge=1, le=10, alias="reviewsPerProject")
    max_per_judge: int | None = Field(default=None, ge=1, le=500, alias="maxPerJudge")
    batch: str | None = Field(default=None, max_length=80)
    dry_run: bool = Field(default=False, alias="dryRun")

    model_config = {"populate_by_name": True}


class UnassignBody(BaseModel):
    judge_id: str = Field(alias="judgeId")
    project_id: str = Field(alias="projectId")

    model_config = {"populate_by_name": True}


@router.get("/assignments")
def list_assignments(slug: str, request: Request, db: Session = Depends(get_db)):
    _manager(db, request)
    event = resolve_event(db, slug)
    rows = (
        db.query(JudgeAssignment)
        .options(
            joinedload(JudgeAssignment.judge),
            joinedload(JudgeAssignment.project).joinedload(Project.track),
        )
        .join(JudgeAssignment.project)
        .join(Project.team)
        .filter(Team.event_id == event.id)
        .all()
    )
    scored = {
        (s.judge_id, s.project_id)
        for s in db.query(Score.judge_id, Score.project_id).filter(
            Score.project_id.in_([r.project_id for r in rows] or [""])
        )
    }
    projects = event_projects(db, event)
    superseded = duplicate_map(projects)
    coverage = {p.id: {"assigned": 0, "scored": 0} for p in projects}
    for row in rows:
        if row.project_id in coverage:
            coverage[row.project_id]["assigned"] += 1
            coverage[row.project_id]["scored"] += int((row.judge_id, row.project_id) in scored)

    return {
        "assignments": [
            {
                "judgeId": row.judge.fixture_id or row.judge_id,
                "judgeName": row.judge.name or row.judge.email,
                "projectId": row.project.fixture_id or row.project_id,
                "title": row.project.title,
                "track": row.project.track.name if row.project.track else None,
                "batch": row.batch,
                "assignedAt": iso(row.assigned_at),
                "scored": (row.judge_id, row.project_id) in scored,
            }
            for row in sorted(rows, key=lambda r: (r.project.title, r.judge.name or ""))
        ],
        "projects": [
            {
                "projectId": p.fixture_id or p.id,
                "title": p.title,
                "track": p.track.name if p.track else None,
                "trackId": p.track.fixture_id if p.track else None,
                "assigned": coverage[p.id]["assigned"],
                "scored": coverage[p.id]["scored"],
                "duplicateOf": superseded.get(p.id) and next(
                    (q.fixture_id for q in projects if q.id == superseded[p.id]), None
                ),
            }
            for p in sorted(projects, key=lambda p: (coverage[p.id]["assigned"], p.title))
        ],
    }


@router.post("/assignments")
def assign_batch(slug: str, body: BatchBody, request: Request, db: Session = Depends(get_db)):
    """Assign every listed judge to every listed project, skipping (and
    reporting) pairs that break a rule instead of failing the whole batch."""
    actor = _manager(db, request)
    event = resolve_event(db, slug)
    batch = (body.batch or "").strip() or f"batch {datetime.utcnow():%Y-%m-%d %H:%M}"

    created, skipped = 0, []
    for judge_ref in dict.fromkeys(body.judge_ids):
        seat = _seat_or_404(db, event, judge_ref)
        for project_ref in dict.fromkeys(body.project_ids):
            project = _project(db, event, project_ref)
            reason = ineligible_reason(db, seat, project)
            if reason:
                skipped.append({"judgeId": judge_ref, "projectId": project_ref, "reason": reason})
                continue
            if create_assignment(db, seat, project, batch=batch, actor_id=actor.id):
                created += 1
            else:
                skipped.append({"judgeId": judge_ref, "projectId": project_ref, "reason": "already assigned"})

    log_action(
        db,
        actor_id=actor.id,
        action="assignments.batch",
        resource_type="event",
        resource_id=event.fixture_id,
        metadata={"batch": batch, "created": created, "skipped": len(skipped)},
    )
    db.commit()
    return {"created": created, "skipped": skipped, "batch": batch}


@router.post("/assignments/auto")
def assign_auto(slug: str, body: AutoBody, request: Request, db: Session = Depends(get_db)):
    actor = _manager(db, request)
    event = resolve_event(db, slug)
    plan = plan_auto_assignment(
        db, event, reviews_per_project=body.reviews_per_project, max_per_judge=body.max_per_judge
    )
    batch = (body.batch or "").strip() or f"auto {datetime.utcnow():%Y-%m-%d %H:%M}"

    users = {s.user_id: s.user for s in panel(db, event)}
    summary = {
        "planned": len(plan.pairs),
        "shortfalls": plan.shortfalls,
        "load": sorted(
            (
                {"judgeId": users[uid].fixture_id or uid, "name": users[uid].name or users[uid].email, "assigned": n}
                for uid, n in plan.load.items()
            ),
            key=lambda row: (-row["assigned"], row["name"]),
        ),
        "dryRun": body.dry_run,
        "batch": batch,
    }
    if body.dry_run:
        return summary

    for seat, project in plan.pairs:
        create_assignment(db, seat, project, batch=batch, actor_id=actor.id)
    log_action(
        db,
        actor_id=actor.id,
        action="assignments.auto",
        resource_type="event",
        resource_id=event.fixture_id,
        metadata={
            "batch": batch,
            "reviewsPerProject": body.reviews_per_project,
            "maxPerJudge": body.max_per_judge,
            "created": len(plan.pairs),
            "shortfalls": len(plan.shortfalls),
        },
    )
    db.commit()
    return {**summary, "created": len(plan.pairs)}


@router.delete("/assignments")
def unassign(slug: str, body: UnassignBody, request: Request, db: Session = Depends(get_db)):
    actor = _manager(db, request)
    event = resolve_event(db, slug)
    seat = _seat_or_404(db, event, body.judge_id)
    project = _project(db, event, body.project_id)
    if db.query(Score.id).filter(Score.judge_id == seat.user_id, Score.project_id == project.id).first():
        raise HTTPException(status_code=409, detail="This judge already scored the project; the assignment stays.")
    deleted = (
        db.query(JudgeAssignment)
        .filter(JudgeAssignment.judge_id == seat.user_id, JudgeAssignment.project_id == project.id)
        .delete(synchronize_session=False)
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Assignment not found")
    log_action(
        db,
        actor_id=actor.id,
        action="assignment.removed",
        resource_type="project",
        resource_id=project.fixture_id,
        metadata={"judge": seat.user_id},
    )
    db.commit()
    return {"ok": True}


# --------------------------------------------------------------------------
# Rubric
# --------------------------------------------------------------------------


class CriterionInput(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=300)
    weight: float = Field(gt=0, le=10)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        value = " ".join(value.split()).lower()
        if not value:
            raise ValueError("Criterion name is required")
        return value


class RubricBody(BaseModel):
    criteria: list[CriterionInput] = Field(min_length=1, max_length=MAX_CRITERIA)


@router.get("/rubric")
def get_event_rubric(slug: str, request: Request, db: Session = Depends(get_db)):
    _manager(db, request)
    event = resolve_event(db, slug)
    return {
        "criteria": [serialize_criterion(c) for c in event_rubric(db, event.id)],
        "locked": event_has_scores(db, event),
    }


@router.put("/rubric")
def replace_rubric(slug: str, body: RubricBody, request: Request, db: Session = Depends(get_db)):
    """Replace the rubric. Weights and descriptions can change at any time
    (totals are computed from weights at read time); the set of criteria is
    frozen once the first score exists, so every score rates the same things."""
    actor = _manager(db, request)
    event = resolve_event(db, slug)
    names = [c.name for c in body.criteria]
    if len(set(names)) != len(names):
        raise HTTPException(status_code=400, detail="Criterion names must be unique")

    current = {c.name: c for c in event_rubric(db, event.id)}
    if event_has_scores(db, event) and set(names) != set(current):
        raise HTTPException(
            status_code=409,
            detail="Scoring has started, so criteria can't be added, removed or renamed. "
            "Weights and descriptions can still change.",
        )

    for name, row in current.items():
        if name not in names:
            db.delete(row)
    for order, item in enumerate(body.criteria):
        row = current.get(item.name)
        if not row:
            row = RubricCriterion(event_id=event.id, name=item.name)
            db.add(row)
        row.weight = round(item.weight, 3)
        row.description = (item.description or "").strip() or None
        row.display_order = order

    log_action(
        db,
        actor_id=actor.id,
        action="rubric.updated",
        resource_type="event",
        resource_id=event.fixture_id,
        metadata={"criteria": [{"name": c.name, "weight": c.weight} for c in body.criteria]},
    )
    db.commit()
    return get_event_rubric(slug, request, db)


# --------------------------------------------------------------------------
# Results
# --------------------------------------------------------------------------


@router.get("/results")
def results(slug: str, request: Request, db: Session = Depends(get_db)):
    _manager(db, request)
    event = resolve_event(db, slug)
    return {"event": serialize_event_ref(event), **event_results(db, event)}
