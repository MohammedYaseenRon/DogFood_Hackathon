from datetime import datetime, timedelta

from app.models import Event, EventRegistration, Project, ProjectStatus, Role, Team, Track, User


def test_register_login_and_me(client):
    res = client.post(
        "/api/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "password123",
            "name": "New User",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["user"]["role"] == "VISITOR"

    res = client.get("/api/auth/me")
    assert res.status_code == 200
    assert res.json()["email"] == "newuser@example.com"

    client.post("/api/auth/logout")
    res = client.get("/api/auth/me")
    assert res.status_code == 401

    res = client.post(
        "/api/auth/login",
        json={"email": "newuser@example.com", "password": "password123"},
    )
    assert res.status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_event_registration(client):
    session = client.testing_session()
    event = session.query(Event).first()
    event.registration_opens = datetime.utcnow() - timedelta(days=1)
    event.registration_closes = datetime.utcnow() + timedelta(days=7)
    session.commit()
    session.close()

    client.post(
        "/api/auth/register",
        json={
            "email": "participant@example.com",
            "password": "password123",
            "name": "Participant",
        },
    )

    res = client.post("/api/events/register")
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["alreadyRegistered"] is False

    session = client.testing_session()
    user = session.query(User).filter(User.email == "participant@example.com").first()
    assert user.role == Role.PARTICIPANT
    reg = (
        session.query(EventRegistration)
        .filter(EventRegistration.user_id == user.id)
        .first()
    )
    assert reg is not None
    session.close()

    res = client.post("/api/events/register")
    assert res.status_code == 200
    assert res.json()["alreadyRegistered"] is True


def test_submission_deadline_enforced(client):
    session = client.testing_session()
    event = session.query(Event).first()
    event.submissions_close = datetime.utcnow() - timedelta(hours=1)
    session.commit()

    owner = session.query(User).filter(User.email == "owner@test.local").first()
    team = session.query(Team).first()
    track = session.query(Track).first()
    session.add(
        Project(
            fixture_id="proj_deadline",
            title="Late project",
            summary="Too late",
            repo_url="https://github.com/example/late",
            status=ProjectStatus.DRAFT,
            team_id=team.id,
            track_id=track.id,
        )
    )
    session.commit()
    project = session.query(Project).filter(Project.fixture_id == "proj_deadline").first()
    session.close()

    res = client.patch(
        f"/api/projects/{project.fixture_id}",
        headers={"Cookie": "session=owner_sess"},
        json={"title": "Updated too late"},
    )
    assert res.status_code == 403
    assert "deadline" in res.json()["detail"].lower()


def test_gallery_only_shows_submitted(client):
    session = client.testing_session()
    team = session.query(Team).first()
    track = session.query(Track).first()
    session.add(
        Project(
            fixture_id="proj_draft_only",
            title="Hidden draft",
            summary="Should not appear",
            repo_url="https://github.com/example/draft",
            status=ProjectStatus.DRAFT,
            team_id=team.id,
            track_id=track.id,
        )
    )
    session.commit()
    session.close()

    res = client.get("/api/projects")
    assert res.status_code == 200
    titles = [item["title"] for item in res.json()]
    assert "Hidden draft" not in titles
