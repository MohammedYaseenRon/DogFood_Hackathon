import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import AuditLog, new_id


def log_action(
    db: Session,
    *,
    actor_id: str | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    metadata: dict | None = None,
    event_id: str | None = None,
) -> None:
    """Append to the audit trail. Pass `event_id` (the event's internal id) for
    anything that happens inside an event so organizers can read it."""
    db.add(
        AuditLog(
            id=new_id(),
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_json=json.dumps(metadata or {}),
            event_id=event_id,
            created_at=datetime.utcnow(),
        )
    )
