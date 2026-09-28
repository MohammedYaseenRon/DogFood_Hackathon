import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.config import app_base_url
from app.models import Role, Team, TeamInvite, TeamMember, TeamMemberRole, User


def new_invite_token() -> str:
    return secrets.token_urlsafe(32)


def invite_url(token: str) -> str:
    return f"{app_base_url()}/join/{token}"


def legacy_invite_url(token: str) -> str:
    return f"{app_base_url()}/teams/join/{token}"


def serialize_member(member: TeamMember) -> dict:
    return {
        "id": member.id,
        "userId": member.user_id,
        "name": member.user.name or member.user.email,
        "email": member.user.email,
        "role": member.role.value,
        "joinedAt": member.joined_at.isoformat() + "Z",
    }


def serialize_team(team: Team, membership: TeamMember | None = None) -> dict:
    return {
        "id": team.id,
        "fixtureId": team.fixture_id,
        "name": team.name,
        "eventId": team.event_id,
        "createdBy": team.created_by,
        "createdAt": team.created_at.isoformat() + "Z",
        "updatedAt": team.updated_at.isoformat() + "Z",
        "memberCount": len(team.members),
        "myRole": membership.role.value if membership else None,
    }


def serialize_invite(invite: TeamInvite) -> dict:
    return {
        "id": invite.id,
        "token": invite.token,
        "teamId": invite.team_id,
        "expiresAt": invite.expires_at.isoformat() + "Z",
        "maxUses": invite.max_uses,
        "usedCount": invite.used_count,
        "revoked": invite.revoked,
        "createdAt": invite.created_at.isoformat() + "Z",
        "inviteUrl": invite_url(invite.token),
        "remainingUses": max(invite.max_uses - invite.used_count, 0),
        "expired": invite.expires_at <= datetime.utcnow(),
    }


def get_team_or_404(db: Session, team_id: str) -> Team:
    team = db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


def get_membership(
    db: Session, team_id: str, user_id: str
) -> TeamMember | None:
    return (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        .first()
    )


def require_membership(
    db: Session, team_id: str, user: User
) -> TeamMember:
    membership = get_membership(db, team_id, user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a team member")
    return membership


def require_invite_manager(
    db: Session, team_id: str, user: User
) -> TeamMember:
    membership = require_membership(db, team_id, user)
    if membership.role not in {TeamMemberRole.OWNER, TeamMemberRole.ADMIN}:
        raise HTTPException(
            status_code=403,
            detail="Only team owners or admins can manage invitations",
        )
    return membership


def user_team_for_event(
    db: Session, user_id: str, event_id: str
) -> TeamMember | None:
    return (
        db.query(TeamMember)
        .join(Team)
        .filter(TeamMember.user_id == user_id, Team.event_id == event_id)
        .first()
    )


def validate_invite_record(invite: TeamInvite | None) -> TeamInvite:
    if not invite:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invite.revoked:
        raise HTTPException(status_code=410, detail="Invitation has been revoked")
    if invite.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=410, detail="Invitation has expired")
    if invite.used_count >= invite.max_uses:
        raise HTTPException(
            status_code=410, detail="Invitation has reached maximum uses"
        )
    return invite


def load_invite_by_token(db: Session, token: str) -> TeamInvite | None:
    return (
        db.query(TeamInvite)
        .options(joinedload(TeamInvite.team).joinedload(Team.members))
        .filter(TeamInvite.token == token)
        .first()
    )


def load_legacy_team_by_token(db: Session, token: str) -> Team | None:
    return (
        db.query(Team)
        .options(joinedload(Team.members).joinedload(TeamMember.user))
        .filter(Team.invite_token == token)
        .first()
    )


def invite_preview(db: Session, token: str) -> dict:
    invite = load_invite_by_token(db, token)
    if invite:
        team = invite.team
        if invite.revoked:
            raise HTTPException(status_code=410, detail="Invitation has been revoked")
        if invite.expires_at <= datetime.utcnow():
            raise HTTPException(status_code=410, detail="Invitation has expired")
        if invite.used_count >= invite.max_uses:
            raise HTTPException(
                status_code=410, detail="Invitation has reached maximum uses"
            )
        return {
            "token": invite.token,
            "type": "invite",
            "team": {
                "id": team.id,
                "name": team.name,
                "memberCount": len(team.members),
            },
            "expiresAt": invite.expires_at.isoformat() + "Z",
            "maxUses": invite.max_uses,
            "usedCount": invite.used_count,
            "remainingUses": max(invite.max_uses - invite.used_count, 0),
            "members": [serialize_member(m) for m in team.members],
        }

    team = load_legacy_team_by_token(db, token)
    if not team:
        raise HTTPException(status_code=404, detail="Invitation not found")

    return {
        "token": token,
        "type": "legacy",
        "team": {
            "id": team.id,
            "name": team.name,
            "memberCount": len(team.members),
        },
        "expiresAt": None,
        "maxUses": None,
        "usedCount": None,
        "remainingUses": None,
        "members": [serialize_member(m) for m in team.members],
    }


def join_team_with_token(db: Session, user: User, token: str) -> dict:
    invite = (
        db.query(TeamInvite)
        .options(joinedload(TeamInvite.team))
        .filter(TeamInvite.token == token)
        .with_for_update()
        .first()
    )
    if invite:
        validate_invite_record(invite)
        return _join_team_direct(db, user, invite.team, increment_invite=invite)

    team = load_legacy_team_by_token(db, token)
    if not team:
        raise HTTPException(status_code=404, detail="Invitation not found")
    return _join_team_direct(db, user, team, increment_invite=None)


def _join_team_direct(
    db: Session,
    user: User,
    team: Team,
    *,
    increment_invite: TeamInvite | None,
) -> dict:
    existing = get_membership(db, team.id, user.id)
    if existing:
        return {
            "ok": True,
            "alreadyMember": True,
            "teamId": team.id,
            "teamName": team.name,
            "message": "Already a member of this team",
        }

    other = user_team_for_event(db, user.id, team.event_id)
    if other and other.team_id != team.id:
        raise HTTPException(
            status_code=409,
            detail="You are already on another team for this event",
        )

    if user.role == Role.VISITOR:
        user.role = Role.PARTICIPANT

    db.add(
        TeamMember(
            team_id=team.id,
            user_id=user.id,
            role=TeamMemberRole.MEMBER,
        )
    )

    try:
        if increment_invite:
            increment_invite.used_count += 1
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        existing = get_membership(db, team.id, user.id)
        if existing:
            return {
                "ok": True,
                "alreadyMember": True,
                "teamId": team.id,
                "teamName": team.name,
                "message": "Already a member of this team",
            }
        raise HTTPException(status_code=409, detail="Could not join team") from exc

    return {
        "ok": True,
        "alreadyMember": False,
        "teamId": team.id,
        "teamName": team.name,
        "message": f"Joined {team.name}",
    }


def create_team_invite(
    db: Session,
    team: Team,
    creator: User,
    *,
    expires_in_hours: int = 168,
    max_uses: int = 10,
) -> TeamInvite:
    if expires_in_hours < 1:
        raise HTTPException(status_code=400, detail="expires_in_hours must be positive")
    if max_uses < 1:
        raise HTTPException(status_code=400, detail="max_uses must be positive")

    invite = TeamInvite(
        team_id=team.id,
        token=new_invite_token(),
        created_by=creator.id,
        expires_at=datetime.utcnow() + timedelta(hours=expires_in_hours),
        max_uses=max_uses,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


def revoke_invite(db: Session, invite: TeamInvite) -> None:
    invite.revoked = True
    db.commit()
