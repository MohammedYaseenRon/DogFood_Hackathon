from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models import AuditLog, Event, Project, Role, User

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
def platform_stats(request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ADMIN])
    return {
        "users": db.query(User).count(),
        "events": db.query(Event).count(),
        "projects": db.query(Project).count(),
        "participants": db.query(User).filter(User.role == Role.PARTICIPANT).count(),
        "judges": db.query(User).filter(User.role == Role.JUDGE).count(),
        "organizers": db.query(User).filter(User.role == Role.ORGANIZER).count(),
    }


@router.get("/users")
def list_users(request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ADMIN])
    users = db.query(User).order_by(User.created_at.desc()).limit(200).all()
    return {
        "users": [
            {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role.value,
                "suspended": user.suspended,
                "createdAt": user.created_at.isoformat() + "Z",
            }
            for user in users
        ]
    }


@router.patch("/users/{user_id}/suspend")
def suspend_user(user_id: str, request: Request, db: Session = Depends(get_db)):
    admin = require_role(db, request, [Role.ADMIN])
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot suspend yourself")
    user.suspended = True
    db.commit()
    return {"ok": True}


@router.get("/audit")
def audit_logs(request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ADMIN, Role.ORGANIZER])
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(100).all()
    return {
        "logs": [
            {
                "id": log.id,
                "actorId": log.actor_id,
                "action": log.action,
                "resourceType": log.resource_type,
                "resourceId": log.resource_id,
                "metadata": log.metadata_json,
                "createdAt": log.created_at.isoformat() + "Z",
            }
            for log in logs
        ]
    }
