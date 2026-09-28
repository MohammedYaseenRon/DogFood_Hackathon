from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from app.auth import get_session_user
from app.config import app_base_url
from app.database import get_db
from app.models import Event, Role, Team, TeamMember, TeamMemberRole, User, new_id
from app.services.team_invites import (
    create_team_invite,
    get_membership,
    get_team_or_404,
    invite_preview,
    invite_url,
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


class CreateInviteBody(BaseModel):
    expires_in_hours: int = Field(default=168, ge=1, le=8760)
    max_uses: int = Field(default=10, ge=1, le=1000)


def _active_event(db: Session) -> Event:
    event = db.query(Event).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def _require_participant(user: User) -> None:
    if user.role not in {Role.PARTICIPANT, Role.VISITOR}:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/api/teams")
def create_team(
    body: CreateTeamBody, request: Request, db: Session = Depends(get_db)
):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    _require_participant(user)

    event = _active_event(db)
    if user_team_for_event(db, user.id, event.id):
        raise HTTPException(status_code=409, detail="Already on a team for this event")

    if user.role == Role.VISITOR:
        user.role = Role.PARTICIPANT

    team = Team(
        fixture_id=new_id(),
        name=body.name.strip(),
        event_id=event.id,
        created_by=user.id,
    )
    db.add(team)
    db.flush()
    db.add(
        TeamMember(
            team_id=team.id,
            user_id=user.id,
            role=TeamMemberRole.OWNER,
        )
    )
    db.commit()
    db.refresh(team)

    membership = get_membership(db, team.id, user.id)
    return {
        "ok": True,
        "team": {
            **serialize_team(team, membership),
            "inviteUrl": f"{app_base_url()}/teams/{team.id}",
        },
    }


@router.get("/api/teams/mine")
def my_team(request: Request, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    event = db.query(Event).first()
    if not event:
        return {"team": None}

    membership = user_team_for_event(db, user.id, event.id)
    if not membership:
        return {"team": None}

    team = (
        db.query(Team)
        .options(joinedload(Team.members))
        .filter(Team.id == membership.team_id)
        .first()
    )
    if not team:
        return {"team": None}

    return {
        "team": {
            **serialize_team(team, membership),
            "teamUrl": f"{app_base_url()}/teams/{team.id}",
        }
    }


@router.get("/api/teams/{team_id}")
def get_team(team_id: str, request: Request, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    team = (
        db.query(Team)
        .options(joinedload(Team.members).joinedload(TeamMember.user))
        .filter(Team.id == team_id)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    membership = require_membership(db, team.id, user)
    return {"team": serialize_team(team, membership)}


@router.get("/api/teams/{team_id}/members")
def get_team_members(
    team_id: str, request: Request, db: Session = Depends(get_db)
):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

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


@router.post("/api/teams/{team_id}/invites")
def create_invite(
    team_id: str,
    body: CreateInviteBody,
    request: Request,
    db: Session = Depends(get_db),
):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    team = get_team_or_404(db, team_id)
    require_invite_manager(db, team.id, user)

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
def legacy_join_team(
    token: str, request: Request, db: Session = Depends(get_db)
):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return join_team_with_token(db, user, token)
