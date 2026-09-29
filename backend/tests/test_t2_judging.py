"""T2: judge invitation and assignment, weighted rubric, backend role isolation,
live progress, cross-judge normalization and CSV export."""

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
    EventJudge,
    EventJudgeTrack,
    JudgeAssignment,
    Project,
    ProjectStatus,
    Role,
    RubricCriterion,
    Score,
    Session as DbSession,
    Team,
    TeamMember,
    TeamMemberRole,
    Track,
    User,
    new_id,
)
from app.services.normalization import Review, normalize

SLUG = "judge-hack"


def h(key: str) -> dict[str, str]:
    return {"Cookie": f"session={key}"}


@pytest.fixture()
def env():
    """An event whose submissions have closed: two tracks, four submitted
    projects plus one draft, three judges (two track-scoped, one event-wide)."""
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = Session()
    now = datetime.utcnow()

    event = Event(
        fixture_id="evt_j",
        slug=SLUG,
        name="Judge Hack",
        submissions_close=now - timedelta(hours=2),
        judging_starts=now - timedelta(hours=1),
        published=True,
    )
    db.add(event)
    db.flush()
    web = Track(fixture_id="trk_web", name="Web", event_id=event.id)
    hw = Track(fixture_id="trk_hw", name="Hardware", event_id=event.id)
    db.add_all([web, hw])
    for order, name in enumerate(["functionality", "quality"]):
        db.add(RubricCriterion(event_id=event.id, name=name, weight=1.0, display_order=order))

    def user(email, role, key, fixture=None):
        row = User(email=email, role=role, name=email.split("@")[0], fixture_id=fixture)
        db.add(row)
        db.flush()
        db.add(DbSession(key=key, user_id=row.id, expires_at=now + timedelta(days=1)))
        return row

    org = user("org@t.local", Role.ORGANIZER, "org")
    web_judge = user("web@t.local", Role.JUDGE, "jweb", "jdg_web")
    hw_judge = user("hw@t.local", Role.JUDGE, "jhw", "jdg_hw")
    any_judge = user("any@t.local", Role.JUDGE, "jany", "jdg_any")
    participant = user("p@t.local", Role.PARTICIPANT, "part")
    visitor = user("v@t.local", Role.VISITOR, "vis")
    db.flush()

    for judge, tracks in [(web_judge, [web]), (hw_judge, [hw]), (any_judge, [])]:
        seat = EventJudge(event_id=event.id, user_id=judge.id)
        seat.tracks = [EventJudgeTrack(track_id=t.id) for t in tracks]
        db.add(seat)

    projects = {}
    for key, track, status in [
        ("prj_w1", web, ProjectStatus.SUBMITTED),
        ("prj_w2", web, ProjectStatus.SUBMITTED),
        ("prj_h1", hw, ProjectStatus.SUBMITTED),
        ("prj_h2", hw, ProjectStatus.SUBMITTED),
        ("prj_draft", web, ProjectStatus.DRAFT),
    ]:
        team = Team(fixture_id=f"tm_{key}", name=f"Team {key}", event_id=event.id)
        db.add(team)
        db.flush()
        if key == "prj_w1":
            db.add(TeamMember(team_id=team.id, user_id=participant.id, role=TeamMemberRole.OWNER))
        project = Project(
            fixture_id=key,
            title=f"Project {key}",
            summary="s",
            repo_url=f"https://example.org/{key}",
            status=status,
            submitted_at=now - timedelta(hours=3) if status == ProjectStatus.SUBMITTED else None,
            team_id=team.id,
            track_id=track.id,
        )
        db.add(project)
        projects[key] = project
    db.commit()
    ids = {"web_judge": web_judge.id, "visitor": visitor.id}
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
        client.ids = ids
        yield client
    app.dependency_overrides.clear()


def assign(client, judge, project):
    return client.post(
        f"/api/organizer/events/{SLUG}/assignments",
        json={"judgeIds": [judge], "projectIds": [project]},
        headers=h("org"),
    )


def score(client, key, project, f=4, q=4):
    return client.post(
        "/api/judge/scores",
        json={"project_id": project, "criteria": {"functionality": f, "quality": q}},
        headers=h(key),
    )


# --------------------------------------------------------------------------
# Assignment
# --------------------------------------------------------------------------


def test_batch_assignment_skips_out_of_track_and_drafts(env):
    res = env.post(
        f"/api/organizer/events/{SLUG}/assignments",
        json={"judgeIds": ["jdg_web"], "projectIds": ["prj_w1", "prj_h1", "prj_draft"], "batch": "Round 1"},
        headers=h("org"),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["created"] == 1
    reasons = {s["projectId"]: s["reason"] for s in body["skipped"]}
    assert reasons == {"prj_h1": "project is outside the judge's tracks", "prj_draft": "project is a draft"}


def test_auto_assignment_respects_tracks_and_balances(env):
    res = env.post(
        f"/api/organizer/events/{SLUG}/assignments/auto",
        json={"reviewsPerProject": 2},
        headers=h("org"),
    )
    assert res.status_code == 200, res.text
    assert res.json()["created"] == 8
    assert res.json()["shortfalls"] == []

    db = env.session_factory()
    pairs = {
        (a.judge.fixture_id, a.project.fixture_id)
        for a in db.query(JudgeAssignment).all()
    }
    db.close()
    for judge, project in pairs:
        if judge == "jdg_web":
            assert project.startswith("prj_w")
        if judge == "jdg_hw":
            assert project.startswith("prj_h")
    assert not any(p == "prj_draft" for _, p in pairs)

    # Running it again only fills gaps: nothing left to do.
    again = env.post(f"/api/organizer/events/{SLUG}/assignments/auto", json={"reviewsPerProject": 2}, headers=h("org"))
    assert again.json()["created"] == 0


def test_auto_assignment_dry_run_writes_nothing_and_reports_shortfall(env):
    res = env.post(
        f"/api/organizer/events/{SLUG}/assignments/auto",
        json={"reviewsPerProject": 3, "dryRun": True},
        headers=h("org"),
    )
    body = res.json()
    assert body["dryRun"] is True
    # Only two judges can see each track, so a third review is impossible.
    assert len(body["shortfalls"]) == 4
    db = env.session_factory()
    assert db.query(JudgeAssignment).count() == 0
    db.close()


def test_judge_who_is_a_team_member_is_never_assigned_their_team(env):
    db = env.session_factory()
    team = db.query(Project).filter(Project.fixture_id == "prj_w2").one().team
    db.add(TeamMember(team_id=team.id, user_id=env.ids["web_judge"], role=TeamMemberRole.MEMBER))
    db.commit()
    db.close()
    res = assign(env, "jdg_web", "prj_w2")
    assert res.json()["skipped"][0]["reason"] == "judge is a member of this team"


def test_assignment_endpoints_are_organizer_only(env):
    for key in ("jweb", "part", "vis"):
        assert assign(env, "jdg_web", "prj_w1").status_code == 200  # organizer control
        res = env.post(
            f"/api/organizer/events/{SLUG}/assignments/auto", json={"reviewsPerProject": 1}, headers=h(key)
        )
        assert res.status_code == 403


# --------------------------------------------------------------------------
# Isolation
# --------------------------------------------------------------------------


def test_track_judge_cannot_score_or_read_other_track(env):
    assign(env, "jdg_hw", "prj_h1")
    # Force an out-of-scope assignment straight into the database; the API
    # layer must still refuse it.
    db = env.session_factory()
    w1 = db.query(Project).filter(Project.fixture_id == "prj_w1").one()
    hw = db.query(User).filter(User.fixture_id == "jdg_hw").one()
    db.add(JudgeAssignment(judge_id=hw.id, project_id=w1.id))
    db.commit()
    db.close()

    listed = {a["projectId"] for a in env.get("/api/judge/assignments", headers=h("jhw")).json()}
    assert listed == {"prj_h1"}
    assert score(env, "jhw", "prj_w1").status_code == 403
    detail = env.get("/api/projects/prj_w1", headers=h("jhw")).json()["project"]
    assert "answers" not in detail  # visitor view, not staff view


def test_unassigned_judge_gets_public_view_and_no_drafts(env):
    assert env.get("/api/projects/prj_draft", headers=h("jany")).status_code == 404
    detail = env.get("/api/projects/prj_w2", headers=h("jany")).json()["project"]
    assert "answers" not in detail
    assign(env, "jdg_any", "prj_w2")
    detail = env.get("/api/projects/prj_w2", headers=h("jany")).json()["project"]
    assert "answers" in detail


def test_judge_cannot_read_peer_scores(env):
    assign(env, "jdg_web", "prj_w1")
    assign(env, "jdg_any", "prj_w1")
    assert score(env, "jweb", "prj_w1", 5, 5).status_code == 200
    assert env.get("/api/judge/scores?judge=jdg_web", headers=h("jany")).status_code == 403
    mine = env.get("/api/judge/scores", headers=h("jany")).json()
    assert mine == []
    assert env.get("/api/judge/scores", headers=h("part")).status_code == 403


def test_scoring_waits_for_the_deadline_and_stops_when_judging_ends(env):
    assign(env, "jdg_web", "prj_w1")
    db = env.session_factory()
    event = db.query(Event).filter(Event.slug == SLUG).one()
    event.submissions_close = datetime.utcnow() + timedelta(hours=1)
    db.commit()
    res = score(env, "jweb", "prj_w1")
    assert res.status_code == 409 and "after the submission deadline" in res.json()["detail"]
    event.submissions_close = datetime.utcnow() - timedelta(hours=2)
    event.judging_ends = datetime.utcnow() - timedelta(minutes=1)
    db.commit()
    db.close()
    assert score(env, "jweb", "prj_w1").status_code == 409


@pytest.mark.parametrize(
    "criteria",
    [{"functionality": 4}, {"functionality": 6, "quality": 3}, {"functionality": 3.5, "quality": 3},
     {"functionality": 3, "quality": 3, "vibes": 5}],
)
def test_scores_must_rate_every_criterion_with_a_whole_number(env, criteria):
    assign(env, "jdg_web", "prj_w1")
    res = env.post("/api/judge/scores", json={"project_id": "prj_w1", "criteria": criteria}, headers=h("jweb"))
    assert res.status_code == 400


# --------------------------------------------------------------------------
# Rubric
# --------------------------------------------------------------------------


def test_rubric_weights_change_live_but_criteria_lock_after_first_score(env):
    url = f"/api/organizer/events/{SLUG}/rubric"
    res = env.put(
        url,
        json={"criteria": [{"name": "Functionality", "weight": 3, "description": "Does it run?"}, {"name": "quality", "weight": 1}]},
        headers=h("org"),
    )
    assert res.status_code == 200 and res.json()["locked"] is False
    assign(env, "jdg_web", "prj_w1")
    total = score(env, "jweb", "prj_w1", 5, 1).json()["weightedTotal"]
    assert total == 4.0  # (5*3 + 1*1) / 4

    locked = env.put(url, json={"criteria": [{"name": "functionality", "weight": 1}]}, headers=h("org"))
    assert locked.status_code == 409
    reweighted = env.put(
        url, json={"criteria": [{"name": "functionality", "weight": 1}, {"name": "quality", "weight": 1}]}, headers=h("org")
    )
    assert reweighted.status_code == 200
    assert env.get("/api/judge/scores", headers=h("jweb")).json()[0]["weightedTotal"] == 3.0


# --------------------------------------------------------------------------
# Invitations
# --------------------------------------------------------------------------


def make_invite(env, **body):
    res = env.post(f"/api/organizer/events/{SLUG}/judges/invites", json=body, headers=h("org"))
    assert res.status_code == 201, res.text
    return res.json()["token"]


def test_visitor_accepts_invite_and_becomes_track_judge(env):
    token = make_invite(env, trackIds=["trk_hw"])
    preview = env.get(f"/api/judge-invites/{token}").json()
    assert preview["tracks"] == ["Hardware"]
    assert env.post(f"/api/judge-invites/{token}/accept", headers=h("vis")).status_code == 200

    db = env.session_factory()
    visitor = db.get(User, env.ids["visitor"])
    assert visitor.role == Role.JUDGE
    seat = db.query(EventJudge).filter(EventJudge.user_id == visitor.id).one()
    assert [t.track_id for t in seat.tracks] == [db.query(Track).filter(Track.fixture_id == "trk_hw").one().id]
    db.close()
    # Single use.
    assert env.post(f"/api/judge-invites/{token}/accept", headers=h("jany")).status_code == 410


def test_invite_refuses_wrong_email_participants_and_staff(env):
    locked = make_invite(env, email="someone@else.org")
    assert env.post(f"/api/judge-invites/{locked}/accept", headers=h("vis")).status_code == 403
    open_invite = make_invite(env)
    assert env.post(f"/api/judge-invites/{open_invite}/accept", headers=h("part")).status_code == 409
    assert env.post(f"/api/judge-invites/{open_invite}/accept", headers=h("org")).status_code == 409
    assert env.post(f"/api/judge-invites/{open_invite}/accept").status_code == 401


def test_narrowing_scope_withdraws_unscored_assignments_and_protects_scored(env):
    assign(env, "jdg_any", "prj_w1")
    assign(env, "jdg_any", "prj_h1")
    url = f"/api/organizer/events/{SLUG}/judges/jdg_any"
    res = env.patch(url, json={"trackIds": ["trk_web"]}, headers=h("org"))
    assert res.json()["withdrawn"] == 1
    assert score(env, "jany", "prj_w1").status_code == 200
    blocked = env.patch(url, json={"trackIds": ["trk_hw"]}, headers=h("org"))
    assert blocked.status_code == 409


# --------------------------------------------------------------------------
# Progress, results, exports
# --------------------------------------------------------------------------


def test_progress_shows_who_has_not_started(env):
    assign(env, "jdg_web", "prj_w1")
    assign(env, "jdg_hw", "prj_h1")
    score(env, "jweb", "prj_w1")
    progress = env.get(f"/api/organizer/events/{SLUG}/judging/progress", headers=h("org")).json()
    status = {j["id"]: j["status"] for j in progress["judges"]}
    assert status == {"jdg_web": "done", "jdg_hw": "not_started", "jdg_any": "unassigned"}
    assert progress["totals"]["notStarted"] == 1


def test_results_rank_by_normalized_score(env):
    env.post(f"/api/organizer/events/{SLUG}/assignments/auto", json={"reviewsPerProject": 2}, headers=h("org"))
    for key, values in {
        "jweb": {"prj_w1": 5, "prj_w2": 3},
        "jhw": {"prj_h1": 3, "prj_h2": 2},
        "jany": {"prj_w1": 4, "prj_w2": 2, "prj_h1": 4, "prj_h2": 3},
    }.items():
        for project, value in values.items():
            assert score(env, key, project, value, value).status_code == 200
    data = env.get(f"/api/organizer/events/{SLUG}/results", headers=h("org")).json()
    ranked = [r["projectId"] for r in data["projects"] if r["rank"]]
    assert ranked[0] == "prj_w1"
    assert all(r["reviews"] == 2 for r in data["projects"] if r["rank"])
    assert data["method"]["name"]


@pytest.mark.parametrize(
    "kind", ["registrations", "teams", "submissions", "judges", "assignments", "scores", "results"]
)
def test_every_stage_exports_csv_for_organizers_only(env, kind):
    url = f"/api/export.csv?event={SLUG}&kind={kind}"
    res = env.get(url, headers=h("org"))
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert "," in res.text.splitlines()[0]
    assert env.get(url, headers=h("jweb")).status_code == 403
    assert env.get(url, headers=h("part")).status_code == 403


def test_csv_neutralises_spreadsheet_formulas(env):
    db = env.session_factory()
    project = db.query(Project).filter(Project.fixture_id == "prj_w1").one()
    project.title = '=HYPERLINK("http://evil","x")'
    db.commit()
    db.close()
    text = env.get(f"/api/export.csv?event={SLUG}&kind=submissions", headers=h("org")).text
    assert "'=HYPERLINK" in text


# --------------------------------------------------------------------------
# Normalization (pure)
# --------------------------------------------------------------------------


def _reviews(table):
    return [Review(j, p, float(v)) for j, row in table.items() for p, v in row.items()]


def test_lenient_judge_offset_is_removed():
    projects = [f"p{i}" for i in range(8)]
    fair = {p: 1 + i * 0.5 for i, p in enumerate(projects)}
    # Same opinions, but judge B is a full point more generous.
    table = {"a": fair, "b": {p: min(5, v + 1) for p, v in fair.items()}}
    result = normalize(_reviews(table))
    raw_gap = abs(result.judges["a"].raw_mean - result.judges["b"].raw_mean)
    for p in projects[:5]:
        normalized_gap = abs(result.projects[p].normalized_reviews["a"] - result.projects[p].normalized_reviews["b"])
        assert normalized_gap < raw_gap


def test_flat_judge_and_single_review_judge_stay_finite():
    table = {
        "flat": {"p1": 4, "p2": 4, "p3": 4},
        "once": {"p1": 2},
        "normal": {"p1": 5, "p2": 3, "p3": 1},
    }
    result = normalize(_reviews(table))
    assert result.judges["flat"].flat is True
    for project in result.projects.values():
        assert 1 <= project.normalized <= 5
    # The flat judge didn't discriminate, so their reviews barely separate projects.
    flat = [result.projects[p].normalized_reviews["flat"] for p in ("p1", "p2", "p3")]
    assert max(flat) - min(flat) < 1e-9
    # A single review is shrunk toward the average judge rather than erased.
    once = result.judges["once"]
    assert once.raw_mean < once.mean < result.event_mean
    assert result.projects["p1"].low_confidence is False
    assert result.projects["p2"].low_confidence is True


def test_normalization_preserves_a_judges_own_ordering():
    table = {"a": {"p1": 2, "p2": 3, "p3": 5}, "b": {"p1": 4, "p2": 4, "p3": 5}}
    result = normalize(_reviews(table))
    a = [result.projects[p].normalized_reviews["a"] for p in ("p1", "p2", "p3")]
    assert a == sorted(a)
