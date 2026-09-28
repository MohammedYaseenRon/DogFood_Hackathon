"""T1 behaviour: events, drafts, submission rules, deadline enforcement, gallery, auth."""

from datetime import datetime, timedelta

from app.models import CustomQuestion, Event, Role, Session as DbSession, User

OWNER = {"Cookie": "session=owner_sess"}
MEMBER = {"Cookie": "session=member_sess"}
OUTSIDER = {"Cookie": "session=outsider_sess"}


def _make_organizer(client) -> dict:
    db = client.testing_session()
    user = User(email="org@test.local", role=Role.ORGANIZER, name="Org")
    db.add(user)
    db.flush()
    db.add(DbSession(key="org_sess", user_id=user.id, expires_at=datetime.utcnow() + timedelta(days=1)))
    db.commit()
    db.close()
    return {"Cookie": "session=org_sess"}


def _close_event(client) -> None:
    db = client.testing_session()
    event = db.query(Event).filter(Event.fixture_id == "evt_test").one()
    event.submissions_close = datetime.utcnow() - timedelta(minutes=1)
    db.commit()
    db.close()


def _draft(client, **extra):
    body = {"event": "test-hack", "title": "Draft Project", "track_id": "trk_test", **extra}
    return client.post("/api/projects", headers=OWNER, json=body)


def _complete(**extra):
    return {
        "summary": "A long description of the project.",
        "repo_url": "https://github.com/example/project",
        **extra,
    }


# --- Projects: draft and edit --------------------------------------------


def test_draft_needs_only_title_and_track(client):
    res = _draft(client)
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "DRAFT"
    assert res.json()["submittedAt"] is None


def test_draft_hidden_from_public_but_visible_to_team(client):
    project_id = _draft(client).json()["id"]
    assert client.get(f"/api/projects/{project_id}").status_code == 404
    assert client.get(f"/api/projects/{project_id}", headers=OUTSIDER).status_code == 404
    mine = client.get(f"/api/projects/{project_id}", headers=OWNER)
    assert mine.status_code == 200
    assert mine.json()["project"]["canEdit"] is True
    assert all(p["id"] != project_id for p in client.get("/api/projects").json())


def test_submit_requires_description_and_repo(client):
    project_id = _draft(client).json()["id"]
    res = client.patch(f"/api/projects/{project_id}", headers=OWNER, json={"status": "SUBMITTED"})
    assert res.status_code == 400
    assert "description" in res.json()["detail"]

    res = client.patch(
        f"/api/projects/{project_id}", headers=OWNER, json={"status": "SUBMITTED", **_complete()}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "SUBMITTED"
    assert res.json()["submittedAt"]
    assert any(p["id"] == project_id for p in client.get("/api/projects").json())


def test_unsubmit_back_to_draft_before_deadline(client):
    project_id = _draft(client, status="SUBMITTED", **_complete()).json()["id"]
    res = client.patch(f"/api/projects/{project_id}", headers=OWNER, json={"status": "DRAFT"})
    assert res.status_code == 200
    assert res.json()["status"] == "DRAFT"
    assert res.json()["submittedAt"] is None


def test_full_field_set_round_trips(client):
    res = _draft(
        client,
        status="SUBMITTED",
        tagline="One line pitch",
        video_url="https://youtube.com/watch?v=abc",
        live_url="https://demo.example.org",
        thumbnail_url="https://img.example.org/t.png",
        image_urls=["https://img.example.org/1.png", "https://img.example.org/2.png"],
        tech_tags=["React", "react", " FastAPI "],
        **_complete(),
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["imageUrls"] == ["https://img.example.org/1.png", "https://img.example.org/2.png"]
    assert body["techTags"] == ["React", "FastAPI"]
    assert body["videoUrl"].startswith("https://youtube.com")


def test_rejects_non_http_urls(client):
    res = _draft(client, repo_url="javascript:alert(1)")
    assert res.status_code == 400


def test_one_project_per_team(client):
    assert _draft(client).status_code == 200
    assert _draft(client).status_code == 409


def test_non_member_cannot_edit(client):
    project_id = _draft(client).json()["id"]
    client.post("/api/teams", headers=OUTSIDER, json={"name": "Other", "event": "test-hack"})
    res = client.patch(f"/api/projects/{project_id}", headers=OUTSIDER, json={"title": "Hijack"})
    assert res.status_code == 404


def test_required_custom_question_blocks_submit(client):
    db = client.testing_session()
    event = db.query(Event).filter(Event.fixture_id == "evt_test").one()
    question = CustomQuestion(event_id=event.id, label="Built during event?", question_type="textarea", required=True)
    db.add(question)
    db.commit()
    question_id = question.id
    db.close()

    project_id = _draft(client).json()["id"]
    res = client.patch(
        f"/api/projects/{project_id}", headers=OWNER, json={"status": "SUBMITTED", **_complete()}
    )
    assert res.status_code == 400
    assert "Built during event?" in res.json()["detail"]

    res = client.patch(
        f"/api/projects/{project_id}",
        headers=OWNER,
        json={"status": "SUBMITTED", "answers": {question_id: "Yes, all of it"}, **_complete()},
    )
    assert res.status_code == 200
    assert res.json()["answers"][question_id] == "Yes, all of it"
    # Answers are private to the team and staff.
    assert "answers" not in client.get(f"/api/projects/{project_id}").json()["project"]


# --- Deadline enforcement ------------------------------------------------


def test_deadline_blocks_create_and_edit(client):
    project_id = _draft(client).json()["id"]
    _close_event(client)

    assert client.patch(f"/api/projects/{project_id}", headers=OWNER, json={"title": "Late"}).status_code == 403
    assert client.patch(
        f"/api/projects/{project_id}", headers=OWNER, json={"status": "DRAFT"}
    ).status_code == 403
    assert client.post("/projects/new", headers=MEMBER, json={"title": "late"}).status_code in (403,)


def test_deadline_blocks_team_formation(client):
    team_id = client.get("/api/teams/mine", headers=OWNER).json()["team"]["id"]
    token = client.post(f"/api/teams/{team_id}/invites", headers=OWNER, json={}).json()["invite"]["token"]
    _close_event(client)

    assert client.post("/api/teams", headers=OUTSIDER, json={"name": "Late", "event": "test-hack"}).status_code == 403
    assert client.post(f"/api/invites/{token}/join", headers=MEMBER).status_code == 403


def test_submissions_not_open_before_start(client):
    db = client.testing_session()
    event = db.query(Event).filter(Event.fixture_id == "evt_test").one()
    event.event_starts = datetime.utcnow() + timedelta(days=1)
    db.commit()
    db.close()
    res = _draft(client)
    assert res.status_code == 403
    assert "start" in res.json()["detail"]


# --- Events --------------------------------------------------------------


def _event_body(**extra):
    return {
        "name": "Spring Hack",
        "submissions_close": (datetime.utcnow() + timedelta(days=10)).isoformat() + "Z",
        "registration_opens": (datetime.utcnow() - timedelta(days=1)).isoformat() + "Z",
        "tracks": [{"name": "AI", "description": "Models"}, {"name": "Web"}],
        "prizes": [{"name": "Best AI", "amount": "$500", "rank": 1, "track_index": 0}],
        "questions": [{"label": "Platform", "type": "select", "options": ["Web", "Mobile"]}],
        **extra,
    }


def test_organizer_creates_multiple_events(client):
    org = _make_organizer(client)
    first = client.post("/api/events", headers=org, json=_event_body())
    second = client.post("/api/events", headers=org, json=_event_body())
    assert first.status_code == 200, first.text
    assert second.status_code == 200
    assert first.json()["event"]["slug"] == "spring-hack"
    assert second.json()["event"]["slug"] == "spring-hack-2"
    event = first.json()["event"]
    assert [t["name"] for t in event["tracks"]] == ["AI", "Web"]
    assert event["prizes"][0]["trackName"] == "AI"
    assert event["questions"][0]["options"] == ["Web", "Mobile"]


def test_event_date_order_validated(client):
    org = _make_organizer(client)
    body = _event_body(
        judging_starts=(datetime.utcnow() + timedelta(days=5)).isoformat() + "Z"
    )
    res = client.post("/api/events", headers=org, json=body)
    assert res.status_code == 400
    assert "Judging" in res.json()["detail"]


def test_only_staff_create_events(client):
    assert client.post("/api/events", headers=OWNER, json=_event_body()).status_code == 403
    assert client.post("/api/events", json=_event_body()).status_code == 401


def test_unpublished_event_hidden(client):
    org = _make_organizer(client)
    slug = client.post("/api/events", headers=org, json=_event_body(published=False)).json()["event"]["slug"]
    assert client.get(f"/api/events/{slug}").status_code == 404
    assert client.get(f"/api/events/{slug}", headers=org).status_code == 200
    assert all(e["slug"] != slug for e in client.get("/api/events").json()["events"])


def test_register_for_named_event(client):
    org = _make_organizer(client)
    slug = client.post("/api/events", headers=org, json=_event_body()).json()["event"]["slug"]
    res = client.post(f"/api/events/{slug}/register", headers=OUTSIDER)
    assert res.status_code == 200
    assert res.json()["registered"] is True
    mine = client.get(f"/api/events/registration/mine?event={slug}", headers=OUTSIDER)
    assert mine.json()["registered"] is True


# --- Gallery -------------------------------------------------------------


def test_gallery_search_and_filters(client):
    _draft(client, status="SUBMITTED", tech_tags=["Rust"], tagline="Fast parser", **_complete())
    assert len(client.get("/api/projects?q=parser").json()) == 1
    assert len(client.get("/api/projects?q=nothing-matches").json()) == 0
    assert len(client.get("/api/projects?tag=rust").json()) == 1
    assert len(client.get("/api/projects?track=trk_test").json()) == 1
    assert len(client.get("/api/projects?event=test-hack").json()) == 1
    facets = client.get("/api/projects/facets").json()
    assert facets["tags"] == [{"name": "Rust", "count": 1}]


# --- Auth ----------------------------------------------------------------


def test_register_login_logout_cycle(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "New.User@Example.org", "password": "correct-horse", "name": "New"},
    )
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "VISITOR"
    client.cookies.clear()

    login = client.post("/api/auth/login", json={"email": "new.user@example.org", "password": "correct-horse"})
    assert login.status_code == 200
    key = login.cookies.get("session")
    client.cookies.clear()
    headers = {"Cookie": f"session={key}"}
    assert client.get("/api/auth/me", headers=headers).status_code == 200

    client.post("/api/auth/logout", headers=headers)
    client.cookies.clear()
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_wrong_password_rejected(client):
    client.post("/api/auth/register", json={"email": "a@b.co", "password": "password-1", "name": "A"})
    client.cookies.clear()
    assert client.post("/api/auth/login", json={"email": "a@b.co", "password": "nope"}).status_code == 401


def test_admin_changes_roles(client):
    db = client.testing_session()
    admin = User(email="admin@test.local", role=Role.ADMIN, name="Admin")
    db.add(admin)
    db.flush()
    db.add(DbSession(key="admin_sess", user_id=admin.id, expires_at=datetime.utcnow() + timedelta(days=1)))
    outsider_id = db.query(User).filter(User.email == "outsider@test.local").one().id
    db.commit()
    db.close()
    admin_headers = {"Cookie": "session=admin_sess"}

    res = client.patch(f"/api/admin/users/{outsider_id}/role", headers=admin_headers, json={"role": "JUDGE"})
    assert res.status_code == 200
    assert client.get("/api/auth/me", headers=OUTSIDER).json()["role"] == "JUDGE"
    assert client.patch(
        f"/api/admin/users/{outsider_id}/role", headers=OWNER, json={"role": "ADMIN"}
    ).status_code == 403


# --- Team membership -----------------------------------------------------


def _join_member(client) -> str:
    team_id = client.get("/api/teams/mine", headers=OWNER).json()["team"]["id"]
    token = client.post(f"/api/teams/{team_id}/invites", headers=OWNER, json={}).json()["invite"]["token"]
    assert client.post(f"/api/invites/{token}/join", headers=MEMBER).status_code == 200
    return team_id


def test_member_leaves_and_owner_cannot_abandon_team(client):
    team_id = _join_member(client)
    members = client.get(f"/api/teams/{team_id}/members", headers=OWNER).json()["members"]
    owner = next(m for m in members if m["role"] == "OWNER")
    member = next(m for m in members if m["role"] == "MEMBER")

    assert client.delete(f"/api/teams/{team_id}/members/{owner['id']}", headers=OWNER).status_code == 400
    assert client.delete(f"/api/teams/{team_id}/members/{owner['id']}", headers=MEMBER).status_code == 403
    assert client.delete(f"/api/teams/{team_id}/members/{member['id']}", headers=MEMBER).status_code == 200
    assert client.get("/api/teams/mine?event=test-hack", headers=MEMBER).json()["team"] is None


def test_owner_transfers_ownership(client):
    team_id = _join_member(client)
    members = client.get(f"/api/teams/{team_id}/members", headers=OWNER).json()["members"]
    member = next(m for m in members if m["role"] == "MEMBER")
    res = client.patch(f"/api/teams/{team_id}/members/{member['id']}", headers=OWNER, json={"role": "OWNER"})
    assert res.status_code == 200
    roles = {m["email"]: m["role"] for m in client.get(f"/api/teams/{team_id}/members", headers=OWNER).json()["members"]}
    assert roles == {"owner@test.local": "ADMIN", "member@test.local": "OWNER"}
