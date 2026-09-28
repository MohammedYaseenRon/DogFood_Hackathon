from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session, joinedload

from app.auth import require_user
from app.database import get_db
from app.models import Event, EventRegistration, Project, Team, TeamMember
from app.services.events import iso, serialize_event_ref

router = APIRouter(prefix="/api/participant", tags=["participant"])


@router.get("/overview")
def participant_overview(request: Request, db: Session = Depends(get_db)):
    """Every event the user is involved in, with their team and project status."""
    user = require_user(db, request)

    registrations = {
        reg.event_id: reg
        for reg in db.query(EventRegistration).filter(EventRegistration.user_id == user.id)
    }
    memberships = {
        membership.team.event_id: membership
        for membership in db.query(TeamMember)
        .options(joinedload(TeamMember.team).joinedload(Team.members))
        .filter(TeamMember.user_id == user.id)
    }

    event_ids = set(registrations) | set(memberships)
    events = db.query(Event).filter(Event.id.in_(event_ids)).all() if event_ids else []

    entries = []
    for event in sorted(events, key=lambda e: e.submissions_close, reverse=True):
        registration = registrations.get(event.id)
        membership = memberships.get(event.id)
        team_payload = None
        project_payload = None
        if membership:
            team = membership.team
            team_payload = {
                "id": team.id,
                "name": team.name,
                "myRole": membership.role.value,
                "memberCount": len(team.members),
                "maxTeamSize": event.max_team_size,
            }
            project = db.query(Project).filter(Project.team_id == team.id).first()
            if project:
                project_payload = {
                    "id": project.fixture_id,
                    "title": project.title,
                    "tagline": project.tagline,
                    "status": project.status.value,
                    "submittedAt": iso(project.submitted_at),
                    "updatedAt": iso(project.updated_at),
                }
        entries.append(
            {
                "event": serialize_event_ref(event),
                "registered": registration is not None or membership is not None,
                "registeredAt": iso(registration.registered_at) if registration else None,
                "team": team_payload,
                "project": project_payload,
            }
        )

    return {"entries": entries}
