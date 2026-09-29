"""Whole-event export and import over HTTP. The format lives in
app/services/portable.py; the CLI twin is `python -m app.transfer`."""

import json

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models import Role
from app.services.audit import log_action
from app.services.events import resolve_event
from app.services.portable import ImportError_, conflicts, export_event, import_event, summarize, validate

router = APIRouter(prefix="/api/organizer", tags=["portability"])

MAX_IMPORT_BYTES = 20 * 1024 * 1024


@router.get("/events/{slug}/export.json")
def export_json(slug: str, request: Request, db: Session = Depends(get_db)):
    actor = require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    event = resolve_event(db, slug)
    body = json.dumps(export_event(db, event), indent=2, ensure_ascii=False)
    log_action(db, actor_id=actor.id, action="event.exported", resource_type="event",
               resource_id=event.id, event_id=event.id)
    db.commit()
    return Response(
        body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{event.slug}.dogfood.json"'},
    )


@router.post("/import")
async def import_json(request: Request, dry_run: bool = False, db: Session = Depends(get_db)):
    """`?dry_run=true` checks the file and reports what it would create, writing nothing."""
    actor = require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    raw = await request.body()
    if len(raw) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail="Import files are limited to 20 MB.")
    try:
        data = json.loads(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail={"problems": ["The file is not valid JSON."]})

    problems = validate(data) or conflicts(db, data)
    if problems:
        raise HTTPException(status_code=400, detail={"problems": problems})
    if dry_run:
        return {"dryRun": True, "summary": summarize(data)}

    try:
        event = import_event(db, data, actor=actor)
    except ImportError_ as err:
        raise HTTPException(status_code=400, detail={"problems": err.problems})
    log_action(db, actor_id=actor.id, action="event.imported", resource_type="event",
               resource_id=event.id, metadata=summarize(data), event_id=event.id)
    db.commit()
    return {"dryRun": False, "summary": summarize(data), "event": {"slug": event.slug, "name": event.name}}
