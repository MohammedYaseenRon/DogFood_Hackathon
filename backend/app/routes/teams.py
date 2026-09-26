from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from app.auth import get_session_user
from app.database import get_db
from app.models import Role, Team, TeamMember

router = APIRouter(tags=["teams"])


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
    membership = (
        db.query(TeamMember)
        .options(joinedload(TeamMember.team))
        .filter(TeamMember.user_id == user.id)
        .first()
    )
    if not membership:
        return {"team": None}

    team = membership.team
    return {
        "team": {
            "name": team.name,
            "inviteToken": team.invite_token,
            "inviteUrl": f"/teams/join/{team.invite_token}",
        }
    }
