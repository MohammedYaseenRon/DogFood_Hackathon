import re
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.models import Role, Session as DbSession, User


def parse_session_cookie(cookie_header: str | None) -> str | None:
    if not cookie_header:
        return None
    match = re.search(r"(?:^|;\s*)session=([^;]+)", cookie_header)
    return match.group(1) if match else None


def get_session_user(db: Session, request: Request) -> User | None:
    session_key = parse_session_cookie(request.headers.get("cookie"))
    if not session_key:
        return None

    session = db.get(DbSession, session_key)
    if not session or session.expires_at < datetime.utcnow():
        return None

    user = db.get(User, session.user_id)
    if not user or user.suspended:
        return None
    return user


def create_user_session(db: Session, user: User, response: Response) -> str:
    session_key = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=14)
    db.add(DbSession(key=session_key, user_id=user.id, expires_at=expires_at))
    response.set_cookie(
        key="session",
        value=session_key,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=14 * 24 * 3600,
    )
    return session_key


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "fixtureId": user.fixture_id,
    }


def require_role(db: Session, request: Request, roles: list[Role]) -> User:
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if user.role not in roles:
        raise HTTPException(status_code=403, detail="Forbidden")
    return user


def resolve_judge_alias(db: Session, alias: str) -> User | None:
    if alias == "judge_a":
        return db.query(User).filter(User.fixture_id == "jdg_01").first()
    if alias == "judge_b":
        return db.query(User).filter(User.fixture_id == "jdg_02").first()
    return (
        db.query(User)
        .filter(User.role == Role.JUDGE)
        .filter((User.fixture_id == alias) | (User.id == alias))
        .first()
    )
