from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models import AuditLog, Event, Project, ProjectStatus, Role, User
from app.services.audit import log_action
from app.services.events import iso

router = APIRouter(prefix="/api/admin", tags=["admin"])


class RoleBody(BaseModel):
    role: Role


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "suspended": user.suspended,
        "hasPassword": bool(user.password_hash),
        "createdAt": iso(user.created_at),
    }


@router.get("/stats")
def platform_stats(request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ADMIN])
    return {
        "users": db.query(User).count(),
        "events": db.query(Event).count(),
        "projects": db.query(Project).count(),
        "submitted": db.query(Project).filter(Project.status == ProjectStatus.SUBMITTED).count(),
        "drafts": db.query(Project).filter(Project.status == ProjectStatus.DRAFT).count(),
        "visitors": db.query(User).filter(User.role == Role.VISITOR).count(),
        "participants": db.query(User).filter(User.role == Role.PARTICIPANT).count(),
        "judges": db.query(User).filter(User.role == Role.JUDGE).count(),
        "organizers": db.query(User).filter(User.role == Role.ORGANIZER).count(),
        "admins": db.query(User).filter(User.role == Role.ADMIN).count(),
        "suspended": db.query(User).filter(User.suspended.is_(True)).count(),
    }


@router.get("/users")
def list_users(
    request: Request,
    q: str | None = None,
    role: Role | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    require_role(db, request, [Role.ADMIN])
    query = db.query(User)
    if q and q.strip():
        needle = f"%{q.strip().lower()}%"
        query = query.filter(or_(User.email.ilike(needle), User.name.ilike(needle)))
    if role:
        query = query.filter(User.role == role)
    total = query.count()
    users = query.order_by(User.created_at.desc()).limit(max(1, min(limit, 500))).all()
    return {"total": total, "users": [_serialize_user(user) for user in users]}


def _target_user(db: Session, admin: User, user_id: str) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot change your own account here")
    return user


@router.patch("/users/{user_id}/role")
def change_role(user_id: str, body: RoleBody, request: Request, db: Session = Depends(get_db)):
    admin = require_role(db, request, [Role.ADMIN])
    user = _target_user(db, admin, user_id)
    previous = user.role
    user.role = body.role
    log_action(
        db,
        actor_id=admin.id,
        action="user.role_changed",
        resource_type="user",
        resource_id=user.id,
        metadata={"from": previous.value, "to": body.role.value},
    )
    db.commit()
    return {"ok": True, "user": _serialize_user(user)}


@router.patch("/users/{user_id}/suspend")
def suspend_user(user_id: str, request: Request, db: Session = Depends(get_db)):
    admin = require_role(db, request, [Role.ADMIN])
    user = _target_user(db, admin, user_id)
    user.suspended = True
    log_action(db, actor_id=admin.id, action="user.suspended", resource_type="user", resource_id=user.id)
    db.commit()
    return {"ok": True, "user": _serialize_user(user)}


@router.patch("/users/{user_id}/unsuspend")
def unsuspend_user(user_id: str, request: Request, db: Session = Depends(get_db)):
    admin = require_role(db, request, [Role.ADMIN])
    user = _target_user(db, admin, user_id)
    user.suspended = False
    log_action(db, actor_id=admin.id, action="user.unsuspended", resource_type="user", resource_id=user.id)
    db.commit()
    return {"ok": True, "user": _serialize_user(user)}


@router.get("/audit")
def audit_logs(
    request: Request,
    action: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    require_role(db, request, [Role.ADMIN, Role.ORGANIZER])
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.like(f"{action}%"))
    logs = query.order_by(AuditLog.created_at.desc()).limit(max(1, min(limit, 500))).all()

    actor_ids = {log.actor_id for log in logs if log.actor_id}
    actors = {
        user.id: user
        for user in (db.query(User).filter(User.id.in_(actor_ids)).all() if actor_ids else [])
    }
    return {
        "logs": [
            {
                "id": log.id,
                "actorId": log.actor_id,
                "actorEmail": actors[log.actor_id].email if log.actor_id in actors else None,
                "action": log.action,
                "resourceType": log.resource_type,
                "resourceId": log.resource_id,
                "metadata": log.metadata_json,
                "createdAt": iso(log.created_at),
            }
            for log in logs
        ]
    }

