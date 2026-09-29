"""Sliding-window rate limits stored in the database.

No Redis needed: each allowed action writes one row, the limit check counts
rows for the same key inside the window. Old rows are pruned opportunistically.
Keys are built by the caller, e.g. "comment:user:<id>" or "vote:ip:<hash>".
"""

from __future__ import annotations

import hashlib
import os
import random
from datetime import datetime, timedelta

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.models import RateEvent

TRUSTED_PROXIES = {"127.0.0.1", "::1", "localhost"}
PRUNE_AFTER = timedelta(days=2)


def client_ip(request: Request) -> str:
    """The caller's IP. X-Forwarded-For is only believed when the request comes
    from a trusted proxy (the Next.js server in front of the API)."""
    peer = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and peer in TRUSTED_PROXIES:
        return forwarded.split(",")[0].strip() or peer
    return peer


def _salt() -> str:
    return os.getenv("FINGERPRINT_SALT", "hackboard-local-salt")


def fingerprint(request: Request, scope: str) -> str:
    """A salted, scoped hash of IP + user agent. Comparable within one scope
    (one event) so repeat devices can be spotted, useless anywhere else."""
    raw = f"{_salt()}|{scope}|{client_ip(request)}|{request.headers.get('user-agent', '')}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def ip_key(request: Request) -> str:
    return hashlib.sha256(f"{_salt()}|{client_ip(request)}".encode()).hexdigest()[:24]


def hit(db: Session, key: str, *, limit: int, window: timedelta, message: str | None = None) -> None:
    """Record one action under `key`, or raise 429 if the window is full."""
    now = datetime.utcnow()
    since = now - window
    used = db.query(RateEvent).filter(RateEvent.key == key, RateEvent.created_at >= since).count()
    if used >= limit:
        oldest = (
            db.query(RateEvent.created_at)
            .filter(RateEvent.key == key, RateEvent.created_at >= since)
            .order_by(RateEvent.created_at.asc())
            .first()
        )
        retry = int(((oldest[0] + window) - now).total_seconds()) + 1 if oldest else int(window.total_seconds())
        raise HTTPException(
            status_code=429,
            detail=message or "Too many requests. Slow down and try again shortly.",
            headers={"Retry-After": str(max(retry, 1))},
        )
    db.add(RateEvent(key=key, created_at=now))
    if random.random() < 0.02:
        db.query(RateEvent).filter(RateEvent.created_at < now - PRUNE_AFTER).delete(synchronize_session=False)
    db.flush()
