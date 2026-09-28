from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.auth import require_user
from app.config import app_base_url
from app.database import get_db
from app.models import (
    Project,
    Role,
    Team,
    TeamInvite,
    TeamMember,
    TeamMemberRole,
    User,
    new_id,
)
from app.services.audit import log_action
from app.services.event_state import can_form_team
from app.services.events import ensure_registration, resolve_event
from app.services.team_invites import (
    create_team_invite,
    get_membership,
    get_team_or_404,
    invite_preview,
    join_team_with_token,
    require_invite_manager,
    require_membership,
    serialize_invite,
    serialize_member,
    serialize_team,
    user_team_for_event,
)

router = APIRouter(tags=["teams"])


class CreateTeamBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    event: str | None = None


class UpdateTeamBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class CreateInviteBody(BaseModel):
    expires_in_hours: int = Field(default=168, ge=1, le=8760)
    max_uses: int = Field(default=10, ge=1, le=1000)


def _require_participant(user: User) -> None:
    if user.role not in {Role.PARTICIPANT, Role.VISITOR}:
        raise HTTPException(
            status_code=403,
            detail=f"{user.role.value.title()} accounts cannot form participant teams",
        )


def _require_team_window(team: Team) -> None:
    if team.event and not can_form_team(team.event):
        raise HTTPException(status_code=403, detail="Team changes are closed for this event")


def _load_team(db: Session, team_id: str) -> Team:
    team = (
        db.query(Team)
        .options(joinedload(Team.members).joinedload(TeamMember.user), joinedload(Team.event))
        .filter(Team.id == team_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


def _team_payload(db: Session, team: Team, membership: TeamMember | None) -> dict:
    project = db.query(Project).filter(Project.team_id == team.id).first()
    return {
        **serialize_team(team, membership),
        "teamUrl": f"{app_base_url()}/teams/{team.id}",
        "project": {
            "id": project.fixture_id,
            "title": project.title,
            "status": project.status.value,
        }
        if project
        else None,
    }


@router.post("/api/teams")
def create_team(body: CreateTeamBody, request: Request, db: Session = Depends(get_db)):
    user = require_user(db, request)
    _require_participant(user)

    event = resolve_event(db, body.event)
    if not can_form_team(event):
        raise HTTPException(status_code=403, detail="Team formation is closed for this event")
    if user_team_for_event(db, user.id, event.id):
        raise HTTPException(status_code=409, detail="Already on a team for this event")

    if user.role == Role.VISITOR:
        user.role = Role.PARTICIPANT
    ensure_registration(db, event, user)

    team = Team(
        fixture_id=new_id(),
        name=body.name.strip(),
        description=(body.description or "").strip() or None,
        event_id=event.id,
        created_by=user.id,
    )
    db.add(team)
    db.flush()
    db.add(TeamMember(team_id=team.id, user_id=user.id, role=TeamMemberRole.OWNER))
    log_action(
        db,
        actor_id=user.id,
        action="team.created",
        resource_type="team",
        resource_id=team.id,
        metadata={"event": event.fixture_id},
    )
    db.commit()

    team = _load_team(db, team.id)
    membership = get_membership(db, team.id, user.id)
    return {"ok": True, "team": _team_payload(db, team, membership)}


@router.get("/api/teams/mine")
def my_team(request: Request, event: str | None = None, db: Session = Depends(get_db)):
    user = require_user(db, request)
    try:
        target = resolve_event(db, event)
    except HTTPException:
        return {"team": None}

    membership = user_team_for_event(db, user.id, target.id)
    if not membership:
        return {"team": None}
    team = _load_team(db, membership.team_id)
    return {"team": _team_payload(db, team, membership)}


@router.get("/api/teams/mine/all")
def my_teams(request: Request, db: Session = Depends(get_db)):
    user = require_user(db, request)
    memberships = (
        db.query(TeamMember)
        .filter(TeamMember.user_id == user.id)
        .order_by(TeamMember.joined_at.desc())
        .all()
    )
    return {
        "teams": [
            _team_payload(db, _load_team(db, membership.team_id), membership)
            for membership in memberships
        ]
    }


@router.get("/api/teams/{team_id}")
def get_team(team_id: str, request: Request, db: Session = Depends(get_db)):
    user = require_user(db, request)
    team = _load_team(db, team_id)
    membership = require_membership(db, team.id, user)
    return {"team": _team_payload(db, team, membership)}


@router.patch("/api/teams/{team_id}")
def update_team(
    team_id: str, body: UpdateTeamBody, request: Request, db: Session = Depends(get_db)
):
    user = require_user(db, request)
    team = _load_team(db, team_id)
    membership = require_invite_manager(db, team.id, user)
    _require_team_window(team)
    team.name = body.name.strip()
    team.description = (body.description or "").strip() or None
    log_action(db, actor_id=user.id, action="team.updated", resource_type="team", resource_id=team.id)
    db.commit()
    return {"team": _team_payload(db, _load_team(db, team.id), membership)}


@router.get("/api/teams/{team_id}/members")
def get_team_members(team_id: str, request: Request, db: Session = Depends(get_db)):
    user = require_user(db, request)
    team = get_team_or_404(db, team_id)
    require_membership(db, team.id, user)

    members = (
        db.query(TeamMember)
        .options(joinedload(TeamMember.user))
        .filter(TeamMember.team_id == team.id)
        .order_by(TeamMember.joined_at.asc())
        .all()
    )
    return {"members": [serialize_member(member) for member in members]}


@router.delete("/api/teams/{team_id}/members/{member_id}")
def remove_member(
    team_id: str, member_id: str, request: Request, db: Session = Depends(get_db)
):
    """Owners/admins remove a member; any member may remove themselves (leave)."""
    user = require_user(db, request)
    team = _load_team(db, team_id)
    actor = require_membership(db, team.id, user)
    _require_team_window(team)

    target = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team.id, TeamMember.id == member_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    leaving = target.user_id == user.id
    if not leaving and actor.role not in {TeamMemberRole.OWNER, TeamMemberRole.ADMIN}:
        raise HTTPException(status_code=403, detail="Only team owners or admins can remove members")
    if target.role == TeamMemberRole.OWNER:
        others = [member for member in team.members if member.id != target.id]
        if others:
            raise HTTPException(
                status_code=400,
                detail="Transfer ownership before the owner leaves the team",
            )
        if db.query(Project).filter(Project.team_id == team.id).first():
            raise HTTPException(
                status_code=400,
                detail="The last member cannot leave a team that has a project",
            )

    db.delete(target)
    log_action(
        db,
        actor_id=user.id,
        action="team.member_left" if leaving else "team.member_removed",
        resource_type="team",
        resource_id=team.id,
        metadata={"userId": target.user_id},
    )
    db.flush()

    remaining = db.query(TeamMember).filter(TeamMember.team_id == team.id).count()
    if remaining == 0:
        db.query(TeamInvite).filter(TeamInvite.team_id == team.id).delete(synchronize_session=False)
        db.delete(team)
    db.commit()
    return {"ok": True, "teamDeleted": remaining == 0}


class RoleBody(BaseModel):
    role: TeamMemberRole


@router.patch("/api/teams/{team_id}/members/{member_id}")
def change_member_role(
    team_id: str,
    member_id: str,
    body: RoleBody,
    request: Request,
    db: Session = Depends(get_db),
):
    """Owner promotes/demotes members, or hands ownership to someone else."""
    user = require_user(db, request)
    team = _load_team(db, team_id)
    actor = require_membership(db, team.id, user)
    if actor.role != TeamMemberRole.OWNER:
        raise HTTPException(status_code=403, detail="Only the team owner can change roles")

    target = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team.id, TeamMember.id == member_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.id == actor.id:
        raise HTTPException(status_code=400, detail="Transfer ownership to another member instead")

    if body.role == TeamMemberRole.OWNER:
        actor.role = TeamMemberRole.ADMIN
        team.created_by = target.user_id
    target.role = body.role
    log_action(
        db,
        actor_id=user.id,
        action="team.role_changed",
        resource_type="team",
        resource_id=team.id,
        metadata={"userId": target.user_id, "role": body.role.value},
    )
    db.commit()
    return {"ok": True}


@router.get("/api/teams/{team_id}/invites")
def list_invites(team_id: str, request: Request, db: Session = Depends(get_db)):
    user = require_user(db, request)
    team = get_team_or_404(db, team_id)
    require_invite_manager(db, team.id, user)
    invites = (
        db.query(TeamInvite)
        .filter(
            TeamInvite.team_id == team.id,
            TeamInvite.revoked.is_(False),
            TeamInvite.expires_at > datetime.utcnow(),
        )
        .order_by(TeamInvite.created_at.desc())
        .all()
    )
    return {
        "invites": [
            serialize_invite(invite)
            for invite in invites
            if invite.used_count < invite.max_uses
        ]
    }


@router.post("/api/teams/{team_id}/invites")
def create_invite(
    team_id: str,
    body: CreateInviteBody,
    request: Request,
    db: Session = Depends(get_db),
):
    user = require_user(db, request)
    team = get_team_or_404(db, team_id)
    require_invite_manager(db, team.id, user)
    _require_team_window(team)

    invite = create_team_invite(
        db,
        team,
        user,
        expires_in_hours=body.expires_in_hours,
        max_uses=body.max_uses,
    )
    return {"invite": serialize_invite(invite)}


@router.get("/api/teams/invite/{token}")
def legacy_team_preview(token: str, db: Session = Depends(get_db)):
    return invite_preview(db, token)


@router.post("/api/teams/join/{token}")
def legacy_join_team(token: str, request: Request, db: Session = Depends(get_db)):
    user = require_user(db, request)
    return join_team_with_token(db, user, token)
