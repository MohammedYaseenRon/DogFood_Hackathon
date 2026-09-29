"""Comments on gallery projects.

Signed-in accounts comment on submitted, public projects. Abuse controls:
rate limits per account, a link cap, duplicate-post detection, author and
organizer removal, organizer hiding with a reason, and an audit entry for
every write.
"""

import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.auth import get_session_user, require_user
from app.database import get_db
from app.models import Comment, Project, ProjectStatus, Role, Team, TeamMember, User
from app.services.audit import log_action
from app.services.events import iso
from app.services.ratelimit import hit

router = APIRouter(tags=["comments"])

MAX_LINKS = 2
URL_RE = re.compile(r"https?://", re.IGNORECASE)
STAFF = {Role.ORGANIZER, Role.ADMIN}


class CommentBody(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class HideBody(BaseModel):
    hidden: bool
    reason: str | None = Field(default=None, max_length=300)


def _public_project(db: Session, ref: str) -> Project:
    project = (
        db.query(Project)
        .options(joinedload(Project.team).joinedload(Team.event))
        .filter((Project.fixture_id == ref) | (Project.id == ref))
        .first()
    )
    if not project or project.status != ProjectStatus.SUBMITTED or not project.team.event.published:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _serialize(comment: Comment, viewer: User | None, team_user_ids: set[str]) -> dict:
    staff = bool(viewer and viewer.role in STAFF)
    return {
        "id": comment.id,
        "author": comment.user.name or comment.user.email.split("@")[0],
        "authorRole": comment.user.role.value,
        "fromTeam": comment.user_id in team_user_ids,
        "body": comment.body,
        "createdAt": iso(comment.created_at),
        "hidden": comment.hidden,
        "hiddenReason": comment.hidden_reason if staff else None,
        "mine": bool(viewer and viewer.id == comment.user_id),
        "canDelete": bool(viewer and (viewer.id == comment.user_id or staff)),
        "canModerate": staff,
    }


@router.get("/api/projects/{project_id}/comments")
def list_comments(project_id: str, request: Request, db: Session = Depends(get_db)):
    project = _public_project(db, project_id)
    viewer = get_session_user(db, request)
    staff = bool(viewer and viewer.role in STAFF)
    query = (
        db.query(Comment)
        .options(joinedload(Comment.user))
        .filter(Comment.project_id == project.id, Comment.deleted.is_(False))
    )
    if not staff:
        query = query.filter(Comment.hidden.is_(False))
    team_user_ids = {m.user_id for m in db.query(TeamMember).filter(TeamMember.team_id == project.team_id)}
    comments = query.order_by(Comment.created_at.asc()).all()
    return {
        "comments": [_serialize(c, viewer, team_user_ids) for c in comments],
        "canComment": viewer is not None,
    }


@router.post("/api/projects/{project_id}/comments", status_code=201)
def create_comment(project_id: str, body: CommentBody, request: Request, db: Session = Depends(get_db)):
    user = require_user(db, request)
    project = _public_project(db, project_id)
    text = body.body.strip()
    if len(text) < 2:
        raise HTTPException(status_code=400, detail="Write a little more than that")
    if len(URL_RE.findall(text)) > MAX_LINKS:
        raise HTTPException(status_code=400, detail=f"Comments can contain at most {MAX_LINKS} links")

    duplicate = (
        db.query(Comment.id)
        .filter(
            Comment.user_id == user.id,
            Comment.body == text,
            Comment.created_at >= datetime.utcnow() - timedelta(days=1),
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="You already posted this comment")

    hit(db, f"comment:burst:{user.id}", limit=5, window=timedelta(minutes=1),
        message="You're commenting too fast. Wait a minute.")
    hit(db, f"comment:day:{user.id}", limit=50, window=timedelta(days=1),
        message="Daily comment limit reached. Try again tomorrow.")

    comment = Comment(project_id=project.id, user_id=user.id, body=text)
    db.add(comment)
    db.flush()
    log_action(db, actor_id=user.id, action="comment.created", resource_type="project",
               resource_id=project.fixture_id, metadata={"comment": comment.id, "preview": text[:80]},
               event_id=project.team.event_id)
    db.commit()
    db.refresh(comment)
    team_user_ids = {m.user_id for m in db.query(TeamMember).filter(TeamMember.team_id == project.team_id)}
    return _serialize(comment, user, team_user_ids)


def _comment_or_404(db: Session, comment_id: str) -> Comment:
    comment = (
        db.query(Comment)
        .options(joinedload(Comment.project).joinedload(Project.team), joinedload(Comment.user))
        .filter(Comment.id == comment_id, Comment.deleted.is_(False))
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment


@router.delete("/api/comments/{comment_id}")
def delete_comment(comment_id: str, request: Request, db: Session = Depends(get_db)):
    user = require_user(db, request)
    comment = _comment_or_404(db, comment_id)
    if comment.user_id != user.id and user.role not in STAFF:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    comment.deleted = True
    log_action(db, actor_id=user.id, action="comment.deleted", resource_type="project",
               resource_id=comment.project.fixture_id,
               metadata={"comment": comment.id, "byAuthor": comment.user_id == user.id},
               event_id=comment.project.team.event_id)
    db.commit()
    return {"ok": True}


@router.post("/api/comments/{comment_id}/hide")
def hide_comment(comment_id: str, body: HideBody, request: Request, db: Session = Depends(get_db)):
    user = require_user(db, request)
    if user.role not in STAFF:
        raise HTTPException(status_code=403, detail="Only organizers can moderate comments")
    comment = _comment_or_404(db, comment_id)
    comment.hidden = body.hidden
    comment.hidden_reason = (body.reason or "").strip() or None if body.hidden else None
    comment.hidden_by = user.id if body.hidden else None
    log_action(db, actor_id=user.id, action="comment.hidden" if body.hidden else "comment.unhidden",
               resource_type="project", resource_id=comment.project.fixture_id,
               metadata={"comment": comment.id, "author": comment.user.name or comment.user.email,
                         "reason": comment.hidden_reason},
               event_id=comment.project.team.event_id)
    db.commit()
    return {"ok": True}
