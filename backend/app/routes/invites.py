from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import get_session_user
from app.database import get_db
from app.services.team_invites import (
    invite_preview,
    join_team_with_token,
    load_invite_by_token,
    require_invite_manager,
    revoke_invite,
    serialize_invite,
)

router = APIRouter(tags=["invites"])


@router.get("/api/invites/{token}")
def get_invite(token: str, db: Session = Depends(get_db)):
    return invite_preview(db, token)


@router.post("/api/invites/{token}/join")
def join_via_invite(
    token: str, request: Request, db: Session = Depends(get_db)
):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return join_team_with_token(db, user, token)


@router.delete("/api/invites/{token}")
def delete_invite(token: str, request: Request, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    invite = load_invite_by_token(db, token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found")

    require_invite_manager(db, invite.team_id, user)
    revoke_invite(db, invite)
    return {"ok": True, "invite": serialize_invite(invite)}
