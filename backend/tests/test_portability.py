"""Migration path in and out: the official fixtures import, an export
re-imports into an empty portal unchanged, and bad files are refused whole."""

import copy
import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Event, Project, Score, User
from app.services.portable import ImportError_, export_event, import_event

FIXTURES = Path(__file__).resolve().parents[2] / "dog_food" / "fixtures.json"


def fresh_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


@pytest.fixture()
def fixtures():
    return json.loads(FIXTURES.read_text(encoding="utf-8"))


def comparable(dump: dict) -> dict:
    dump = copy.deepcopy(dump)
    dump.pop("exported_at")
    return dump


def test_official_fixtures_import_as_is(fixtures):
    db = fresh_db()
    event = import_event(db, fixtures)
    db.commit()
    assert event.name == fixtures["event"]["name"]
    assert db.query(Project).count() == len(fixtures["projects"])
    assert db.query(Score).count() == len(fixtures["scores"])
    assert db.query(User).filter(User.email == fixtures["judges"][0]["email"]).one().role.value == "JUDGE"


def test_export_round_trips_into_an_empty_portal(fixtures):
    source = fresh_db()
    import_event(source, fixtures)
    source.commit()
    first = export_event(source, source.query(Event).one())

    target = fresh_db()
    import_event(target, json.loads(json.dumps(first)))
    target.commit()
    second = export_event(target, target.query(Event).one())

    assert comparable(first) == comparable(second)
    assert len(second["projects"]) == len(fixtures["projects"])
    assert len(second["scores"]) == len(fixtures["scores"])


def test_reimport_updates_instead_of_duplicating(fixtures):
    db = fresh_db()
    import_event(db, fixtures)
    db.commit()
    changed = copy.deepcopy(fixtures)
    changed["projects"][0]["title"] = "Renamed in the other tool"
    import_event(db, changed)
    db.commit()
    assert db.query(Event).count() == 1
    assert db.query(Project).count() == len(fixtures["projects"])
    assert db.query(Project).filter(Project.title == "Renamed in the other tool").count() == 1


def test_bad_file_is_refused_with_every_problem_and_nothing_written(fixtures):
    db = fresh_db()
    broken = copy.deepcopy(fixtures)
    broken["projects"][0]["track"] = "trk_missing"
    broken["scores"][0]["criteria"] = {"quality": 9}
    with pytest.raises(ImportError_) as err:
        import_event(db, broken)
    text = " ".join(err.value.problems)
    assert "trk_missing" in text and "1 to 5" in text
    assert db.query(Event).count() == 0


def test_ids_owned_by_another_event_are_refused(fixtures):
    db = fresh_db()
    import_event(db, fixtures)
    db.commit()
    other = copy.deepcopy(fixtures)
    other["event"]["id"] = "evt_other"
    with pytest.raises(ImportError_) as err:
        import_event(db, other)
    assert "another event" in err.value.problems[0]


def test_http_export_then_import_as_organizer(client, fixtures):
    from datetime import datetime, timedelta

    from app.models import Role, Session as DbSession
    from tests.conftest import auth_headers

    db = client.testing_session()
    organizer = User(email="org@test.local", role=Role.ORGANIZER, name="Org")
    db.add(organizer)
    db.flush()
    db.add(DbSession(key="org_sess", user_id=organizer.id, expires_at=datetime.utcnow() + timedelta(days=1)))
    db.commit()
    db.close()
    org, owner = auth_headers("org_sess"), auth_headers("owner_sess")
    body = json.dumps(fixtures)

    assert client.get("/api/organizer/events/test-hack/export.json").status_code == 401
    assert client.get("/api/organizer/events/test-hack/export.json", headers=owner).status_code == 403
    assert client.post("/api/organizer/import", content=body, headers=owner).status_code == 403

    preview = client.post("/api/organizer/import?dry_run=true", content=body, headers=org)
    assert preview.status_code == 200 and preview.json()["summary"]["projects"] == len(fixtures["projects"])
    assert client.get("/api/organizer/events/sample-hack-2026/export.json", headers=org).status_code == 404

    done = client.post("/api/organizer/import", content=body, headers=org)
    assert done.status_code == 200, done.text
    slug = done.json()["event"]["slug"]
    exported = client.get(f"/api/organizer/events/{slug}/export.json", headers=org)
    assert exported.status_code == 200 and "attachment" in exported.headers["content-disposition"]
    assert len(exported.json()["projects"]) == len(fixtures["projects"])

    bad = client.post("/api/organizer/import", content=b"{not json", headers=org)
    assert bad.status_code == 400
