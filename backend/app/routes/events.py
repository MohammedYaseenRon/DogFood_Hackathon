from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role
from app.database import get_db
from app.models import Event, Prize, Role, RubricCriterion, Track, new_id

router = APIRouter(tags=["events"])


class PrizeInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    amount: str = Field(min_length=1, max_length=100)
    rank: int = Field(default=1, ge=1)
    track_index: int | None = Field(default=None, ge=0)


class TrackInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class CreateEventBody(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    submissions_close: str = Field(min_length=1)
    tracks: list[TrackInput] = Field(min_length=1)
    prizes: list[PrizeInput] = Field(default_factory=list)


def _serialize_event(event: Event) -> dict:
    return {
        "id": event.fixture_id,
        "name": event.name,
        "submissionsClose": event.submissions_close.isoformat() + "Z",
        "tracks": [
            {"id": track.fixture_id, "name": track.name} for track in event.tracks
        ],
        "prizes": [
            {
                "id": prize.id,
                "name": prize.name,
                "amount": prize.amount,
                "rank": prize.rank,
                "trackId": prize.track.fixture_id if prize.track else None,
                "trackName": prize.track.name if prize.track else None,
            }
            for prize in sorted(event.prizes, key=lambda p: p.rank)
        ],
        "rubric": [
            {"name": criterion.name, "weight": criterion.weight}
            for criterion in event.rubric
        ],
    }


@router.get("/api/event")
def get_event(db: Session = Depends(get_db)):
    event = (
        db.query(Event)
        .options(
            joinedload(Event.tracks),
            joinedload(Event.rubric),
            joinedload(Event.prizes).joinedload(Prize.track),
        )
        .first()
    )
    if not event:
        return {"event": None}

    return {"event": _serialize_event(event)}


@router.post("/api/events")
def create_event(
    body: CreateEventBody, request: Request, db: Session = Depends(get_db)
):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])

    if db.query(Event).first():
        raise HTTPException(
            status_code=409,
            detail="An event already exists. Only one event is supported.",
        )

    try:
        submissions_close = datetime.fromisoformat(
            body.submissions_close.replace("Z", "+00:00")
        ).replace(tzinfo=None)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid submissions_close") from exc

    event = Event(
        fixture_id=new_id(),
        name=body.name.strip(),
        submissions_close=submissions_close,
    )
    db.add(event)
    db.flush()

    created_tracks: list[Track] = []
    for track_input in body.tracks:
        track = Track(
            fixture_id=new_id(),
            name=track_input.name.strip(),
            event_id=event.id,
        )
        db.add(track)
        db.flush()
        created_tracks.append(track)

    for prize_input in body.prizes:
        track_id = None
        if prize_input.track_index is not None:
            if prize_input.track_index >= len(created_tracks):
                raise HTTPException(status_code=400, detail="Invalid prize track_index")
            track_id = created_tracks[prize_input.track_index].id

        db.add(
            Prize(
                event_id=event.id,
                name=prize_input.name.strip(),
                amount=prize_input.amount.strip(),
                rank=prize_input.rank,
                track_id=track_id,
            )
        )

    for name in ("functionality", "quality", "innovation"):
        db.add(RubricCriterion(event_id=event.id, name=name, weight=1.0))

    db.commit()

    event = (
        db.query(Event)
        .options(
            joinedload(Event.tracks),
            joinedload(Event.rubric),
            joinedload(Event.prizes).joinedload(Prize.track),
        )
        .filter(Event.id == event.id)
        .first()
    )
    return {"event": _serialize_event(event)}
