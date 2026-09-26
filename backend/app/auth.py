import re
from datetime import datetime

from fastapi import HTTPException, Request
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

    return db.get(User, session.user_id)


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
