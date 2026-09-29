from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import SessionLocal, init_db
from app.models import Event
from app.routes import (
    admin,
    auth_routes,
    comments,
    event_audit,
    events,
    export,
    invites,
    judge,
    judge_invites,
    judging_admin,
    organizer,
    participant,
    portable,
    projects,
    teams,
    uploads,
    voting,
)
from app.seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        if db.query(Event).first() is None:
            db.close()
            seed()
        else:
            db.close()
    except Exception:
        db.close()
        seed()
    yield


app = FastAPI(title="Dogfood Portal API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(judge.router)
app.include_router(export.router)
app.include_router(auth_routes.router)
app.include_router(events.router)
app.include_router(teams.router)
app.include_router(invites.router)
app.include_router(organizer.router)
app.include_router(judging_admin.router)
app.include_router(judge_invites.router)
app.include_router(uploads.router)
app.include_router(voting.router)
app.include_router(comments.router)
app.include_router(event_audit.router)
app.include_router(admin.router)
app.include_router(participant.router)
app.include_router(portable.router)


@app.get("/health")
def health():
    return {"status": "ok"}
