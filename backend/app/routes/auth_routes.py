import re
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import AfterValidator, BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.auth import (
    create_user_session,
    current_session_key,
    get_session_user,
    require_user,
    serialize_user,
)
from app.config import TEST_SESSIONS, demo_logins_enabled
from app.database import get_db
from app.models import Role, Session as DbSession, User, new_id
from app.services.audit import log_action
from app.services.passwords import hash_password, verify_password
from app.services.ratelimit import hit, ip_key

router = APIRouter(prefix="/api/auth", tags=["auth"])

PROTECTED_SESSION_KEYS = set(TEST_SESSIONS.values())

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _valid_email(value: str) -> str:
    # Deliberately permissive: self-hosted installs use internal domains
    # (e.g. *.local) that strict validators reject.
    value = value.strip().lower()
    if len(value) > 254 or not _EMAIL_RE.match(value):
        raise ValueError("Enter a valid email address")
    return value


Email = Annotated[str, AfterValidator(_valid_email)]


class RegisterBody(BaseModel):
    email: Email
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)


class LoginBody(BaseModel):
    email: Email
    password: str = Field(min_length=1, max_length=128)


class ProfileBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class PasswordBody(BaseModel):
    current_password: str | None = Field(default=None, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return serialize_user(user)


@router.patch("/me")
def update_me(body: ProfileBody, request: Request, db: Session = Depends(get_db)):
    user = require_user(db, request)
    user.name = body.name.strip()
    log_action(db, actor_id=user.id, action="user.profile_updated", resource_type="user", resource_id=user.id)
    db.commit()
    return serialize_user(user)


@router.post("/password")
def change_password(body: PasswordBody, request: Request, db: Session = Depends(get_db)):
    user = require_user(db, request)
    if user.password_hash:
        if not body.current_password or not verify_password(body.current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(body.new_password)

    # Sign out every other session for this user.
    keep = current_session_key(request)
    for session in db.query(DbSession).filter(DbSession.user_id == user.id).all():
        if session.key != keep and session.key not in PROTECTED_SESSION_KEYS:
            db.delete(session)

    log_action(db, actor_id=user.id, action="user.password_changed", resource_type="user", resource_id=user.id)
    db.commit()
    return {"ok": True}


@router.post("/register")
def register(body: RegisterBody, request: Request, response: Response, db: Session = Depends(get_db)):
    # Cheap accounts are the raw material of Sybil voting: cap sign-ups per network.
    hit(db, f"auth:register:{ip_key(request)}", limit=10, window=timedelta(hours=1),
        message="Too many accounts created from this network. Try again later.")
    db.commit()
    email = body.email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        id=new_id(),
        email=email,
        name=body.name.strip(),
        password_hash=hash_password(body.password),
        role=Role.VISITOR,
    )
    db.add(user)
    log_action(
        db,
        actor_id=user.id,
        action="user.registered",
        resource_type="user",
        resource_id=user.id,
    )
    create_user_session(db, user, response)
    db.commit()
    db.refresh(user)
    return {"ok": True, "user": serialize_user(user)}


@router.post("/login")
def login(body: LoginBody, request: Request, response: Response, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        # Only failures count, so a user who knows their password is never locked out.
        hit(db, f"auth:login-fail:{ip_key(request)}:{email}", limit=10, window=timedelta(minutes=15),
            message="Too many failed sign-ins. Wait 15 minutes and try again.")
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.suspended:
        raise HTTPException(status_code=403, detail="Account suspended")

    create_user_session(db, user, response)
    log_action(
        db,
        actor_id=user.id,
        action="user.login",
        resource_type="user",
        resource_id=user.id,
    )
    db.commit()
    return {"ok": True, "user": serialize_user(user)}


@router.post("/session")
def use_session(key: str, response: Response, db: Session = Depends(get_db)):
    """Dev/demo login: attach a seeded session cookie. Disabled with DEMO_LOGINS=0."""
    if not demo_logins_enabled() or key not in PROTECTED_SESSION_KEYS:
        raise HTTPException(status_code=404, detail="Session not found")

    session = (
        db.query(DbSession)
        .options(joinedload(DbSession.user))
        .filter(DbSession.key == key)
        .first()
    )
    if not session or session.expires_at < datetime.utcnow() or session.user.suspended:
        raise HTTPException(status_code=404, detail="Session not found")

    response.set_cookie(
        key="session",
        value=key,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return {"ok": True, "user": serialize_user(session.user)}


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    key = current_session_key(request)
    if key and key not in PROTECTED_SESSION_KEYS:
        session = db.get(DbSession, key)
        if session:
            db.delete(session)
    if user:
        log_action(
            db,
            actor_id=user.id,
            action="user.logout",
            resource_type="user",
            resource_id=user.id,
        )
    db.commit()
    response.delete_cookie(key="session", path="/")
    return {"ok": True}
