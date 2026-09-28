from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session, joinedload

from app.auth import create_user_session, get_session_user, serialize_user
from app.database import get_db
from app.models import Role, Session as DbSession, User, new_id
from app.services.audit import log_action
from app.services.passwords import hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return serialize_user(user)


@router.post("/register")
def register(body: RegisterBody, response: Response, db: Session = Depends(get_db)):
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
def login(body: LoginBody, response: Response, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
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
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
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
