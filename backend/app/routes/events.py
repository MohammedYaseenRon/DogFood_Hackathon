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
    id: str | None = None
    name: str = Field(min_length=1, max_length=200)


class EventConfigBody(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    submissions_close: str = Field(min_length=1)
    tracks: list[TrackInput] = Field(min_length=1)
    prizes: list[PrizeInput] = Field(default_factory=list)


def _parse_close_date(raw: str) -> datetime:
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid submissions_close") from exc


def _load_event(db: Session, event_id: str | None = None) -> Event | None:
    query = db.query(Event).options(
        joinedload(Event.tracks),
        joinedload(Event.rubric),
        joinedload(Event.prizes).joinedload(Prize.track),
    )
    if event_id:
        return query.filter(Event.fixture_id == event_id).first()
    return query.first()


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


def _sync_tracks(db: Session, event: Event, tracks: list[TrackInput]) -> list[Track]:
    existing = {track.fixture_id: track for track in event.tracks}
    ordered: list[Track] = []

    for track_input in tracks:
        name = track_input.name.strip()
        if track_input.id and track_input.id in existing:
            track = existing[track_input.id]
            track.name = name
            ordered.append(track)
        else:
            track = Track(fixture_id=new_id(), name=name, event_id=event.id)
            db.add(track)
            db.flush()
            ordered.append(track)

    return ordered


def _sync_prizes(
    db: Session, event: Event, prizes: list[PrizeInput], tracks: list[Track]
) -> None:
    for prize in list(event.prizes):
        db.delete(prize)
    db.flush()

    for prize_input in prizes:
        track_id = None
        if prize_input.track_index is not None:
            if prize_input.track_index >= len(tracks):
                raise HTTPException(status_code=400, detail="Invalid prize track_index")
            track_id = tracks[prize_input.track_index].id

        db.add(
            Prize(
                event_id=event.id,
                name=prize_input.name.strip(),
                amount=prize_input.amount.strip(),
                rank=prize_input.rank,
                track_id=track_id,
            )
        )


def _ensure_rubric(db: Session, event: Event) -> None:
    if event.rubric:
        return
    for name in ("functionality", "quality", "innovation"):
        db.add(RubricCriterion(event_id=event.id, name=name, weight=1.0))


@router.get("/api/event")
def get_event(db: Session = Depends(get_db)):
    event = _load_event(db)
    if not event:
        return {"event": None}
    return {"event": _serialize_event(event)}


@router.post("/api/events")
def create_event(body: EventConfigBody, request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])

    if db.query(Event).first():
        raise HTTPException(
            status_code=409,
            detail="An event already exists. Use edit to update it.",
        )

    event = Event(
        fixture_id=new_id(),
        name=body.name.strip(),
        submissions_close=_parse_close_date(body.submissions_close),
    )
    db.add(event)
    db.flush()

    tracks = _sync_tracks(db, event, body.tracks)
    _sync_prizes(db, event, body.prizes, tracks)
    _ensure_rubric(db, event)
    db.commit()

    event = _load_event(db, event.fixture_id)
    return {"event": _serialize_event(event)}


@router.patch("/api/events")
def update_event(body: EventConfigBody, request: Request, db: Session = Depends(get_db)):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])

    event = db.query(Event).first()
    if not event:
        raise HTTPException(status_code=404, detail="No event to update")

    event.name = body.name.strip()
    event.submissions_close = _parse_close_date(body.submissions_close)

    tracks = _sync_tracks(db, event, body.tracks)
    _sync_prizes(db, event, body.prizes, tracks)
    _ensure_rubric(db, event)
    db.commit()

    event = _load_event(db, event.fixture_id)
    return {"event": _serialize_event(event)}
