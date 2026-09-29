"""An event's audit trail, written for organizers rather than DBAs: every
entry has a plain-language label, a category and a one-line summary."""

import json

from fastapi import APIRouter, Depends, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models import AuditLog, Role, User
from app.services.events import iso, resolve_event

router = APIRouter(prefix="/api/organizer/events/{slug}/audit", tags=["audit"])

LABELS = {
    "event.created": ("Event created", "setup"),
    "event.updated": ("Event settings changed", "setup"),
    "event.imported": ("Event imported", "setup"),
    "event.exported": ("Event exported", "setup"),
    "rubric.updated": ("Rubric changed", "judging"),
    "judge.invited": ("Judge invited", "judging"),
    "judge.invite_revoked": ("Judge invite revoked", "judging"),
    "judge.invite_accepted": ("Judge joined the panel", "judging"),
    "judge.seated": ("Judge added to the panel", "judging"),
    "judge.scope_changed": ("Judge tracks changed", "judging"),
    "judge.removed": ("Judge removed", "judging"),
    "assignments.batch": ("Projects assigned (batch)", "judging"),
    "assignments.auto": ("Projects assigned (automatic)", "judging"),
    "assignment.removed": ("Assignment removed", "judging"),
    "score.submitted": ("Score submitted", "judging"),
    "score.updated": ("Score changed", "judging"),
    "voting.configured": ("Voting settings changed", "voting"),
    "voting.link_rotated": ("Voting link replaced", "voting"),
    "vote.cast": ("Ballot saved", "voting"),
    "vote.email_verified": ("Voter verified email", "voting"),
    "vote.voided": ("Ballot voided", "voting"),
    "vote.restored": ("Ballot restored", "voting"),
    "comment.created": ("Comment posted", "comments"),
    "comment.deleted": ("Comment deleted", "comments"),
    "comment.hidden": ("Comment hidden", "comments"),
    "comment.unhidden": ("Comment restored", "comments"),
    "project.created": ("Draft started", "submissions"),
    "project.submitted": ("Project submitted", "submissions"),
    "project.unsubmitted": ("Project moved back to draft", "submissions"),
    "project.updated": ("Project edited", "submissions"),
    "team.created": ("Team created", "teams"),
    "team.joined": ("Member joined a team", "teams"),
}


def _summary(action: str, meta: dict) -> str:
    if action == "event.imported":
        source = f" from {meta['source']}" if meta.get("source") else ""
        return f"{meta.get('projects', 0)} projects, {meta.get('scores', 0)} scores{source}"
    if action == "vote.cast":
        return f"{meta.get('voter', 'A voter')} backed {meta.get('projects', 0)} projects ({meta.get('spent', 0)} spent)"
    if action in ("vote.voided", "vote.restored"):
        reason = f": {meta['reason']}" if meta.get("reason") else ""
        return f"{meta.get('voter', 'Ballot')}{reason}"
    if action == "comment.created":
        return f"“{meta.get('preview', '')}”"
    if action == "comment.hidden":
        return f"Comment by {meta.get('author', 'someone')}" + (f": {meta['reason']}" if meta.get("reason") else "")
    if action in ("score.submitted", "score.updated") and "weightedTotal" in meta:
        return f"Weighted total {meta['weightedTotal']}"
    if action.startswith("assignments."):
        return f"{meta.get('created', 0)} created" + (f" in “{meta['batch']}”" if meta.get("batch") else "")
    if action == "judge.invited":
        tracks = ", ".join(meta.get("tracks") or []) or "all tracks"
        return f"{meta.get('email') or 'Open link'} · {tracks}"
    if action == "voting.configured" and meta:
        return "; ".join(f"{k}: {v.get('from')} → {v.get('to')}" for k, v in meta.items() if isinstance(v, dict))
    if action == "rubric.updated" and meta.get("criteria"):
        return ", ".join(f"{c['name']} ×{c['weight']}" for c in meta["criteria"])
    return ""


def audit_entries(db: Session, event, *, category: str | None = None, limit: int = 300) -> list[dict]:
    query = db.query(AuditLog).filter(
        or_(
            AuditLog.event_id == event.id,
            AuditLog.resource_id == event.fixture_id,
            AuditLog.metadata_json.like(f'%"event": "{event.fixture_id}"%'),
        )
    )
    if category:
        actions = [a for a, (_, c) in LABELS.items() if c == category]
        query = query.filter(AuditLog.action.in_(actions or [""]))
    logs = query.order_by(AuditLog.created_at.desc()).limit(max(1, min(limit, 2000))).all()
    actor_ids = {log.actor_id for log in logs if log.actor_id}
    actors = {u.id: u for u in db.query(User).filter(User.id.in_(actor_ids or [""]))}

    rows = []
    for log in logs:
        meta = json.loads(log.metadata_json or "{}")
        label, cat = LABELS.get(log.action, (log.action.replace(".", " ").replace("_", " ").capitalize(), "other"))
        actor = actors.get(log.actor_id)
        rows.append(
            {
                "id": log.id,
                "at": iso(log.created_at),
                "action": log.action,
                "label": label,
                "category": cat,
                "actor": (actor.name or actor.email) if actor else (meta.get("voter") or "System / anonymous"),
                "actorRole": actor.role.value if actor else None,
                "summary": _summary(log.action, meta),
                "resource": f"{log.resource_type} {log.resource_id or ''}".strip(),
            }
        )
    return rows


@router.get("")
def event_audit(slug: str, request: Request, category: str | None = None, limit: int = 300, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    event = resolve_event(db, slug)
    rows = audit_entries(db, event, category=category, limit=limit)
    return {"entries": rows, "categories": sorted({c for _, c in LABELS.values()})}
