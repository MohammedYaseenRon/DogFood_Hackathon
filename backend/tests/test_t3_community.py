"""T3: community voting (three access modes, quadratic and simple), hidden
results, randomised ballots, comments and anti-abuse."""

import math
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import (
    Event,
    Project,
    ProjectStatus,
    Role,
    Session as DbSession,
    Team,
    TeamMember,
    TeamMemberRole,
    Track,
    User,
    VotingAccess,
    VotingConfig,
    VotingMode,
)
from app.services.voting import canonical_email

SLUG = "vote-hack"


def h(key: str) -> dict[str, str]:
    return {"Cookie": f"session={key}"}


@pytest.fixture()
def env():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = Session()
    now = datetime.utcnow()
    event = Event(fixture_id="evt_v", slug=SLUG, name="Vote Hack", submissions_close=now - timedelta(hours=1), published=True)
    db.add(event)
    db.flush()
    track = Track(fixture_id="trk_v", name="General", event_id=event.id)
    db.add(track)

    def user(email, role, key):
        row = User(email=email, role=role, name=email.split("@")[0], created_at=now - timedelta(days=3))
        db.add(row)
        db.flush()
        db.add(DbSession(key=key, user_id=row.id, expires_at=now + timedelta(days=1)))
        return row

    user("org@t.local", Role.ORGANIZER, "org")
    alice = user("alice@t.local", Role.PARTICIPANT, "alice")
    user("bob@t.local", Role.VISITOR, "bob")
    user("carol@t.local", Role.VISITOR, "carol")
    db.flush()

    for index in range(1, 7):
        team = Team(fixture_id=f"tm_{index}", name=f"Team {index}", event_id=event.id)
        db.add(team)
        db.flush()
        if index == 1:
            db.add(TeamMember(team_id=team.id, user_id=alice.id, role=TeamMemberRole.OWNER))
        db.add(
            Project(
                fixture_id=f"p{index}",
                title=f"Project {index}",
                summary="s",
                repo_url=f"https://example.org/{index}",
                status=ProjectStatus.SUBMITTED,
                submitted_at=now - timedelta(hours=2),
                team_id=team.id,
                track_id=track.id,
            )
        )
    db.add(
        VotingConfig(
            event_id=event.id,
            enabled=True,
            access=VotingAccess.AUTHENTICATED,
            mode=VotingMode.QUADRATIC,
            credits=25,
            opens_at=now - timedelta(hours=1),
            closes_at=now + timedelta(days=1),
            link_token="secret-link",
        )
    )
    db.commit()
    db.close()

    def override():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = override
    with TestClient(app) as client:
        client.session_factory = Session
        yield client
    app.dependency_overrides.clear()


def configure(env, **changes):
    db = env.session_factory()
    config = db.query(VotingConfig).one()
    for key, value in changes.items():
        setattr(config, key, value)
    db.commit()
    db.close()


def vote(env, allocations, headers=None, **kw):
    return env.put(f"/api/vote/{SLUG}", json={"allocations": allocations, **kw}, headers=headers or {})


# --------------------------------------------------------------------------
# Access modes
# --------------------------------------------------------------------------


def test_authenticated_mode_requires_sign_in(env):
    assert env.get(f"/api/vote/{SLUG}").json()["needs"] == "signin"
    assert vote(env, {"p2": 4}).status_code == 401
    assert vote(env, {"p2": 4}, h("bob")).status_code == 200


def test_open_link_mode_requires_the_secret_link(env):
    configure(env, access=VotingAccess.OPEN)
    assert env.get(f"/api/vote/{SLUG}").json()["needs"] == "link"
    assert env.get(f"/api/vote/{SLUG}?k=wrong").json()["needs"] == "link"
    ballot = env.get(f"/api/vote/{SLUG}?k=secret-link").json()
    assert ballot["voter"]["kind"] == "anon"
    # The cookie set on first visit is now the credential.
    assert vote(env, {"p3": 9}).status_code == 200


def test_email_mode_verifies_with_a_one_time_code(env):
    configure(env, access=VotingAccess.EMAIL)
    assert env.get(f"/api/vote/{SLUG}").json()["needs"] == "email"
    start = env.post(f"/api/vote/{SLUG}/email/start", json={"email": "Voter+tag@Example.org"}).json()
    code = start["devCode"]
    bad = env.post(f"/api/vote/{SLUG}/email/verify", json={"email": "voter@example.org", "code": "000000" if code != "000000" else "111111"})
    assert bad.status_code == 400
    ok = env.post(f"/api/vote/{SLUG}/email/verify", json={"email": "voter@example.org", "code": code})
    assert ok.status_code == 200
    assert vote(env, {"p2": 1}).status_code == 200


def test_email_aliases_collapse_to_one_voter():
    assert canonical_email("J.Doe+hack@gmail.com") == canonical_email("jdoe@googlemail.com") == "jdoe@gmail.com"
    assert canonical_email("Ann+x@corp.io") == "ann@corp.io"


def test_email_code_attempts_are_capped(env):
    configure(env, access=VotingAccess.EMAIL)
    code = env.post(f"/api/vote/{SLUG}/email/start", json={"email": "x@example.org"}).json()["devCode"]
    wrong = "123456" if code != "123456" else "654321"
    for _ in range(5):
        env.post(f"/api/vote/{SLUG}/email/verify", json={"email": "x@example.org", "code": wrong})
    locked = env.post(f"/api/vote/{SLUG}/email/verify", json={"email": "x@example.org", "code": code})
    assert locked.status_code == 400 and "expired" in locked.json()["detail"]


# --------------------------------------------------------------------------
# Ballot rules
# --------------------------------------------------------------------------


def test_quadratic_budget_and_square_root_influence(env):
    assert vote(env, {"p2": 16, "p3": 10}, h("bob")).status_code == 400  # 26 > 25
    assert vote(env, {"p2": 16, "p3": 9}, h("bob")).status_code == 200
    assert vote(env, {"p2": 1}, h("carol")).status_code == 200
    rows = {r["projectId"]: r for r in env.get(f"/api/organizer/events/{SLUG}/voting/results", headers=h("org")).json()["projects"]}
    assert rows["p2"]["score"] == pytest.approx(math.sqrt(16) + 1)
    assert rows["p3"]["score"] == pytest.approx(3)
    # 16 credits bought 4x the influence of 1 credit, not 16x.
    assert rows["p2"]["supporters"] == 2


def test_simple_mode_is_one_vote_per_project(env):
    configure(env, mode=VotingMode.SIMPLE, credits=2)
    assert vote(env, {"p2": 2}, h("bob")).status_code == 400
    assert vote(env, {"p2": 1, "p3": 1, "p4": 1}, h("bob")).status_code == 400
    assert vote(env, {"p2": 1, "p3": 1}, h("bob")).status_code == 200


def test_cannot_vote_for_own_team(env):
    ballot = env.get(f"/api/vote/{SLUG}", headers=h("alice")).json()
    own = [p["id"] for p in ballot["projects"] if p["own"]]
    assert own == ["p1"]
    assert vote(env, {"p1": 4}, h("alice")).status_code == 403


def test_ballot_is_editable_and_replaced(env):
    vote(env, {"p2": 9}, h("bob"))
    vote(env, {"p3": 4}, h("bob"))
    assert env.get(f"/api/vote/{SLUG}", headers=h("bob")).json()["allocations"] == {"p3": 4}


def test_voting_only_inside_the_window(env):
    configure(env, closes_at=datetime.utcnow() - timedelta(minutes=1))
    assert vote(env, {"p2": 1}, h("bob")).status_code == 409


def test_ballot_order_is_random_per_voter_and_stable(env):
    orders = {}
    for key in ("bob", "carol", "alice", "org"):
        first = [p["id"] for p in env.get(f"/api/vote/{SLUG}", headers=h(key)).json()["projects"]]
        again = [p["id"] for p in env.get(f"/api/vote/{SLUG}", headers=h(key)).json()["projects"]]
        assert first == again
        orders[key] = tuple(first)
    assert len(set(orders.values())) > 1


# --------------------------------------------------------------------------
# Results visibility
# --------------------------------------------------------------------------


def test_results_hidden_from_everyone_but_organizers_during_voting(env):
    vote(env, {"p2": 9}, h("bob"))
    ballot = env.get(f"/api/vote/{SLUG}", headers=h("bob")).json()
    assert "score" not in str(ballot["projects"])
    for key in ("bob", "alice"):
        assert env.get(f"/api/vote/{SLUG}/results", headers=h(key)).status_code == 403
        assert env.get(f"/api/organizer/events/{SLUG}/voting/results", headers=h(key)).status_code == 403
    assert env.get(f"/api/vote/{SLUG}/results").status_code == 403
    assert env.get(f"/api/organizer/events/{SLUG}/voting/results", headers=h("org")).status_code == 200


def test_results_public_only_after_close_and_publish(env):
    vote(env, {"p2": 9}, h("bob"))
    body = {"enabled": True, "access": "authenticated", "mode": "quadratic", "credits": 25, "resultsPublished": True}
    early = env.put(f"/api/organizer/events/{SLUG}/voting", json=body, headers=h("org"))
    assert early.status_code == 400
    closed = datetime.utcnow() - timedelta(minutes=1)
    configure(env, closes_at=closed)
    assert env.get(f"/api/vote/{SLUG}/results").status_code == 403  # closed, not published
    body["closesAt"] = closed.isoformat()
    assert env.put(f"/api/organizer/events/{SLUG}/voting", json=body, headers=h("org")).status_code == 200
    public = env.get(f"/api/vote/{SLUG}/results")
    assert public.status_code == 200 and public.json()["projects"][0]["projectId"] == "p2"


def test_mode_and_budget_lock_once_ballots_exist(env):
    vote(env, {"p2": 9}, h("bob"))
    body = {"enabled": True, "access": "authenticated", "mode": "simple", "credits": 3}
    assert env.put(f"/api/organizer/events/{SLUG}/voting", json=body, headers=h("org")).status_code == 409


# --------------------------------------------------------------------------
# Anti-abuse
# --------------------------------------------------------------------------


def test_open_link_limits_new_ballots_per_network(env):
    configure(env, access=VotingAccess.OPEN)
    statuses = []
    for _ in range(7):
        env.cookies.clear()
        statuses.append(env.get(f"/api/vote/{SLUG}?k=secret-link").status_code)
    assert 429 in statuses


def test_shared_device_and_identical_ballots_are_flagged_and_voidable(env):
    configure(env, access=VotingAccess.OPEN)
    for _ in range(4):
        env.cookies.clear()
        env.get(f"/api/vote/{SLUG}?k=secret-link")
        assert vote(env, {"p2": 16, "p3": 9}).status_code == 200
    voters = env.get(f"/api/organizer/events/{SLUG}/voting/voters", headers=h("org")).json()["voters"]
    flagged = [v for v in voters if v["flags"]]
    assert len(flagged) == 4
    assert any("identical ballot" in f for f in flagged[0]["flags"])

    target = flagged[0]["id"]
    no_reason = env.post(f"/api/organizer/events/{SLUG}/voting/voters/{target}/void", json={"voided": True}, headers=h("org"))
    assert no_reason.status_code == 400
    env.post(
        f"/api/organizer/events/{SLUG}/voting/voters/{target}/void",
        json={"voided": True, "reason": "ballot stuffing"},
        headers=h("org"),
    )
    results = env.get(f"/api/organizer/events/{SLUG}/voting/results", headers=h("org")).json()
    assert results["ballots"]["voided"] == 1 and results["ballots"]["counted"] == 3


def test_ballot_saves_are_rate_limited(env):
    codes = [vote(env, {"p2": 1}, h("bob")).status_code for _ in range(32)]
    assert codes.count(429) >= 1


def test_audit_trail_is_readable_by_organizers(env):
    vote(env, {"p2": 9}, h("bob"))
    env.post("/api/projects/p2/comments", json={"body": "Great work"}, headers=h("carol"))
    entries = env.get(f"/api/organizer/events/{SLUG}/audit", headers=h("org")).json()["entries"]
    labels = {e["label"] for e in entries}
    assert {"Ballot saved", "Comment posted"} <= labels
    saved = next(e for e in entries if e["label"] == "Ballot saved")
    assert "backed 1 projects" in saved["summary"]
    assert env.get(f"/api/organizer/events/{SLUG}/audit", headers=h("bob")).status_code == 403
    csv = env.get(f"/api/export.csv?event={SLUG}&kind=audit", headers=h("org"))
    assert csv.status_code == 200 and "Ballot saved" in csv.text


# --------------------------------------------------------------------------
# Comments
# --------------------------------------------------------------------------


def test_comments_post_list_and_duplicate_detection(env):
    assert env.post("/api/projects/p2/comments", json={"body": "Nice!"}).status_code == 401
    assert env.post("/api/projects/p2/comments", json={"body": "Nice work here"}, headers=h("bob")).status_code == 201
    assert env.post("/api/projects/p3/comments", json={"body": "Nice work here"}, headers=h("bob")).status_code == 409
    listed = env.get("/api/projects/p2/comments").json()["comments"]
    assert [c["body"] for c in listed] == ["Nice work here"]


def test_comment_link_cap_and_rate_limit(env):
    spam = "see https://a.io https://b.io https://c.io"
    assert env.post("/api/projects/p2/comments", json={"body": spam}, headers=h("bob")).status_code == 400
    codes = [
        env.post("/api/projects/p2/comments", json={"body": f"comment number {i}"}, headers=h("bob")).status_code
        for i in range(7)
    ]
    assert 429 in codes


def test_organizer_hides_and_author_deletes(env):
    cid = env.post("/api/projects/p2/comments", json={"body": "Buy followers now"}, headers=h("bob")).json()["id"]
    assert env.post(f"/api/comments/{cid}/hide", json={"hidden": True}, headers=h("carol")).status_code == 403
    assert env.post(f"/api/comments/{cid}/hide", json={"hidden": True, "reason": "spam"}, headers=h("org")).status_code == 200
    assert env.get("/api/projects/p2/comments").json()["comments"] == []
    staff_view = env.get("/api/projects/p2/comments", headers=h("org")).json()["comments"]
    assert staff_view[0]["hidden"] and staff_view[0]["hiddenReason"] == "spam"

    mine = env.post("/api/projects/p3/comments", json={"body": "Mine to delete"}, headers=h("carol")).json()["id"]
    assert env.delete(f"/api/comments/{mine}", headers=h("bob")).status_code == 403
    assert env.delete(f"/api/comments/{mine}", headers=h("carol")).status_code == 200


@pytest.mark.parametrize("kind", ["votes", "ballots", "comments", "audit"])
def test_community_exports(env, kind):
    vote(env, {"p2": 4}, h("bob"))
    res = env.get(f"/api/export.csv?event={SLUG}&kind={kind}", headers=h("org"))
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/csv")
    assert env.get(f"/api/export.csv?event={SLUG}&kind={kind}", headers=h("bob")).status_code == 403
