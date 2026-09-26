from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.auth import get_session_user
from app.database import get_db
from sqlalchemy.orm import joinedload

from app.models import Session as DbSession

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "fixtureId": user.fixture_id,
    }


@router.post("/session")
def use_session(key: str, response: Response, db: Session = Depends(get_db)):
    """Dev/demo login: attach a seeded session cookie."""
    session = (
        db.query(DbSession)
        .options(joinedload(DbSession.user))
        .filter(DbSession.key == key)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    response.set_cookie(
        key="session",
        value=key,
        httponly=True,
        samesite="lax",
        path="/",
    )
    user = session.user
    return {
        "ok": True,
        "user": {
            "email": user.email,
            "role": user.role.value,
        },
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="session", path="/")
    return {"ok": True}
