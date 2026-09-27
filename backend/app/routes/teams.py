from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from app.auth import get_session_user
from app.database import get_db
from app.models import Event, Role, Team, TeamMember, User, new_id

router = APIRouter(tags=["teams"])


class CreateTeamBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)


def _active_event(db: Session) -> Event:
    event = db.query(Event).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def _user_team_for_event(db: Session, user_id: str, event_id: str) -> TeamMember | None:
    return (
        db.query(TeamMember)
        .join(Team)
        .filter(TeamMember.user_id == user_id, Team.event_id == event_id)
        .first()
    )


@router.get("/api/teams/invite/{token}")
def team_by_invite(token: str, db: Session = Depends(get_db)):
    team = (
        db.query(Team)
        .options(joinedload(Team.members).joinedload(TeamMember.user))
        .filter(Team.invite_token == token)
        .first()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    return {
        "id": team.fixture_id,
        "name": team.name,
        "inviteToken": team.invite_token,
        "members": [
            {"email": member.user.email, "role": member.user.role.value}
            for member in team.members
        ],
    }


@router.post("/api/teams")
def create_team(
    body: CreateTeamBody, request: Request, db: Session = Depends(get_db)
):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if user.role not in {Role.PARTICIPANT, Role.VISITOR}:
        raise HTTPException(status_code=403, detail="Forbidden")

    event = _active_event(db)
    if _user_team_for_event(db, user.id, event.id):
        raise HTTPException(status_code=409, detail="Already on a team for this event")

    if user.role == Role.VISITOR:
        user.role = Role.PARTICIPANT

    team = Team(
        fixture_id=new_id(),
        name=body.name.strip(),
        event_id=event.id,
    )
    db.add(team)
    db.flush()
    db.add(TeamMember(team_id=team.id, user_id=user.id))
    db.commit()
    db.refresh(team)

    return {
        "ok": True,
        "team": {
            "name": team.name,
            "inviteToken": team.invite_token,
            "inviteUrl": f"/teams/join/{team.invite_token}",
        },
    }


@router.post("/api/teams/join/{token}")
def join_team(token: str, request: Request, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    team = db.query(Team).filter(Team.invite_token == token).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    existing = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team.id, TeamMember.user_id == user.id)
        .first()
    )
    if existing:
        return {"ok": True, "team": team.name, "message": "Already a member"}

    other = _user_team_for_event(db, user.id, team.event_id)
    if other and other.team_id != team.id:
        raise HTTPException(
            status_code=409,
            detail="You are already on another team for this event",
        )

    if user.role == Role.VISITOR:
        user.role = Role.PARTICIPANT

    db.add(TeamMember(team_id=team.id, user_id=user.id))
    db.commit()

    return {"ok": True, "team": team.name, "message": "Joined team"}


@router.get("/api/teams/mine")
def my_team(request: Request, db: Session = Depends(get_db)):
    user = get_session_user(db, request)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    event = db.query(Event).first()
    if not event:
        return {"team": None}

    membership = _user_team_for_event(db, user.id, event.id)
    if not membership:
        return {"team": None}

    team = db.get(Team, membership.team_id)
    if not team:
        return {"team": None}

    return {
        "team": {
            "name": team.name,
            "inviteToken": team.invite_token,
            "inviteUrl": f"/teams/join/{team.invite_token}",
        }
    }
