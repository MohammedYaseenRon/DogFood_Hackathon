from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Event, Track

router = APIRouter(tags=["events"])


@router.get("/api/event")
def get_event(db: Session = Depends(get_db)):
    event = (
        db.query(Event)
        .options(joinedload(Event.tracks), joinedload(Event.rubric))
        .first()
    )
    if not event:
        return {"event": None}

    return {
        "event": {
            "id": event.fixture_id,
            "name": event.name,
            "submissionsClose": event.submissions_close.isoformat() + "Z",
            "tracks": [
                {"id": track.fixture_id, "name": track.name} for track in event.tracks
            ],
            "rubric": [
                {"name": criterion.name, "weight": criterion.weight}
                for criterion in event.rubric
            ],
        }
    }
