import os
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["APP_BASE_URL"] = "http://localhost:8080"

from app.database import Base, get_db
from app.main import app
from app.models import Event, Role, Session as DbSession, Team, TeamInvite, TeamMember, TeamMemberRole, User, new_id


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    event = Event(
        fixture_id="evt_test",
        name="Test Hack",
        submissions_close=datetime.utcnow() + timedelta(days=7),
    )
    db = TestingSessionLocal()
    db.add(event)
    db.flush()

    owner = User(email="owner@test.local", role=Role.PARTICIPANT, name="Owner")
    member = User(email="member@test.local", role=Role.PARTICIPANT, name="Member")
    outsider = User(email="outsider@test.local", role=Role.PARTICIPANT, name="Outsider")
    db.add_all([owner, member, outsider])
    db.flush()

    for user, key in [
        (owner, "owner_sess"),
        (member, "member_sess"),
        (outsider, "outsider_sess"),
    ]:
        db.add(
            DbSession(
                key=key,
                user_id=user.id,
                expires_at=datetime.utcnow() + timedelta(days=1),
            )
        )

    team = Team(
        fixture_id=new_id(),
        name="Test Team",
        event_id=event.id,
        created_by=owner.id,
    )
    db.add(team)
    db.flush()
    db.add(
        TeamMember(team_id=team.id, user_id=owner.id, role=TeamMemberRole.OWNER)
    )
    db.commit()
    db.close()

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        test_client.testing_session = TestingSessionLocal
        yield test_client
    app.dependency_overrides.clear()


def auth_headers(session_key: str) -> dict[str, str]:
    return {"Cookie": f"session={session_key}"}
