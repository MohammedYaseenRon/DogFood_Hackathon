"""Image uploads for project thumbnails and galleries.

Files are stored on local disk under UPLOAD_DIR with random names and served
back from /api/uploads/{name}. The type is decided from the file's own bytes,
never from its name or the browser's Content-Type, and only raster formats are
accepted (no SVG, which can carry script).
"""

import os
import re
import secrets
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth import require_role
from app.config import app_base_url
from app.database import get_db
from app.models import AuditLog, Role
from app.services.audit import log_action

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

MAX_BYTES = 5 * 1024 * 1024
DAILY_LIMIT = 100
NAME_RE = re.compile(r"^[0-9a-f]{32}\.(png|jpg|gif|webp)$")
MEDIA_TYPES = {"png": "image/png", "jpg": "image/jpeg", "gif": "image/gif", "webp": "image/webp"}


def upload_dir() -> Path:
    path = Path(os.getenv("UPLOAD_DIR", "./data/uploads"))
    path.mkdir(parents=True, exist_ok=True)
    return path


def sniff(head: bytes) -> str | None:
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


@router.post("", status_code=201)
async def upload_image(request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)):
    user = require_role(db, request, [Role.PARTICIPANT])

    recent = (
        db.query(AuditLog)
        .filter(
            AuditLog.actor_id == user.id,
            AuditLog.action == "upload.created",
            AuditLog.created_at >= datetime.utcnow() - timedelta(days=1),
        )
        .count()
    )
    if recent >= DAILY_LIMIT:
        raise HTTPException(status_code=429, detail="Upload limit reached for today. Try again tomorrow.")

    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Images must be 5 MB or smaller.")
    if not data:
        raise HTTPException(status_code=400, detail="The file is empty.")
    kind = sniff(data[:16])
    if not kind:
        raise HTTPException(status_code=415, detail="Upload a PNG, JPEG, GIF or WebP image.")

    name = f"{secrets.token_hex(16)}.{kind}"
    (upload_dir() / name).write_bytes(data)

    log_action(
        db,
        actor_id=user.id,
        action="upload.created",
        resource_type="upload",
        resource_id=name,
        metadata={"bytes": len(data), "original": (file.filename or "")[:120]},
    )
    db.commit()
    return {"url": f"{app_base_url()}/api/uploads/{name}", "name": name, "size": len(data)}


@router.get("/{name}")
def get_upload(name: str):
    if not NAME_RE.match(name):
        raise HTTPException(status_code=404, detail="Not found")
    path = upload_dir() / name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(
        path,
        media_type=MEDIA_TYPES[name.rsplit(".", 1)[1]],
        headers={
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Security-Policy": "default-src 'none'",
        },
    )
