import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.models import (
    Event,
    JudgeAssignment,
    Project,
    ProjectStatus,
    Role,
    RubricCriterion,
    Score,
    Session as DbSession,
    Team,
    TeamMember,
    Track,
    User,
)

TEST_SESSIONS = {
    "organizer": "org_7f2a",
    "judge_a": "jdg_a_91bc",
    "judge_b": "jdg_b_44de",
    "participant": "prt_2e88",
}


def fixtures_path() -> Path:
    raw = os.getenv("FIXTURES_PATH", "../dog_food/fixtures.json")
    return Path(raw).resolve()


def load_fixtures() -> dict:
    with fixtures_path().open(encoding="utf-8") as handle:
        return json.load(handle)


def upsert_session(db: Session, key: str, user_id: str) -> None:
    expires_at = datetime.utcnow() + timedelta(days=30)
    session = db.get(DbSession, key)
    if session:
        session.user_id = user_id
        session.expires_at = expires_at
    else:
        db.add(DbSession(key=key, user_id=user_id, expires_at=expires_at))


def get_or_create_user(
    db: Session,
    email: str,
    *,
    role: Role,
    name: str | None = None,
    fixture_id: str | None = None,
) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.role = role
        if name is not None:
            user.name = name
        if fixture_id is not None:
            user.fixture_id = fixture_id
        return user

    user = User(email=email, role=role, name=name, fixture_id=fixture_id)
    db.add(user)
    db.flush()
    return user


def get_or_create_event(db: Session, fixture: dict) -> Event:
    event_data = fixture["event"]
    event = db.query(Event).filter(Event.fixture_id == event_data["id"]).first()
    submissions_close = datetime.fromisoformat(
        event_data["submissions_close"].replace("Z", "+00:00")
    ).replace(tzinfo=None)

    if event:
        event.name = event_data["name"]
        event.submissions_close = submissions_close
        return event

    event = Event(
        fixture_id=event_data["id"],
        name=event_data["name"],
        submissions_close=submissions_close,
    )
    db.add(event)
    db.flush()
    return event


def seed() -> None:
    init_db()
    fixtures = load_fixtures()
    db = SessionLocal()

    try:
        event = get_or_create_event(db, fixtures)

        track_map: dict[str, str] = {}
        for track in fixtures["tracks"]:
            row = db.query(Track).filter(Track.fixture_id == track["id"]).first()
            if row:
                row.name = track["name"]
                row.event_id = event.id
            else:
                row = Track(fixture_id=track["id"], name=track["name"], event_id=event.id)
                db.add(row)
                db.flush()
            track_map[track["id"]] = row.id

        criterion_names: set[str] = set()
        for score in fixtures["scores"]:
            criterion_names.update(score["criteria"].keys())

        for name in criterion_names:
            row = (
                db.query(RubricCriterion)
                .filter(RubricCriterion.event_id == event.id, RubricCriterion.name == name)
                .first()
            )
            if not row:
                db.add(RubricCriterion(event_id=event.id, name=name, weight=1.0))

        user_map: dict[str, str] = {}

        organizer = get_or_create_user(
            db,
            "organizer@dogfood.local",
            role=Role.ORGANIZER,
            name="Event Organizer",
            fixture_id="org_01",
        )
        user_map["organizer@dogfood.local"] = organizer.id

        for judge in fixtures["judges"]:
            row = get_or_create_user(
                db,
                judge["email"],
                role=Role.JUDGE,
                name=judge["name"],
                fixture_id=judge["id"],
            )
            user_map[judge["email"]] = row.id
            user_map[judge["id"]] = row.id

        team_map: dict[str, str] = {}
        first_participant_id: str | None = None

        for team in fixtures["teams"]:
            row = db.query(Team).filter(Team.fixture_id == team["id"]).first()
            if row:
                row.name = team["name"]
                row.event_id = event.id
            else:
                row = Team(fixture_id=team["id"], name=team["name"], event_id=event.id)
                db.add(row)
                db.flush()
            team_map[team["id"]] = row.id

            for member_email in team["members"]:
                participant = get_or_create_user(db, member_email, role=Role.PARTICIPANT)
                user_map[member_email] = participant.id
                if first_participant_id is None:
                    first_participant_id = participant.id

                membership = (
                    db.query(TeamMember)
                    .filter(TeamMember.team_id == row.id, TeamMember.user_id == participant.id)
                    .first()
                )
                if not membership:
                    db.add(TeamMember(team_id=row.id, user_id=participant.id))

        project_map: dict[str, str] = {}
        for project in fixtures["projects"]:
            submitted_at = datetime.fromisoformat(
                project["submitted_at"].replace("Z", "+00:00")
            ).replace(tzinfo=None)
            row = db.query(Project).filter(Project.fixture_id == project["id"]).first()
            if row:
                row.title = project["title"]
                row.summary = project["summary"]
                row.repo_url = project["repo_url"]
                row.status = ProjectStatus.SUBMITTED
                row.submitted_at = submitted_at
                row.team_id = team_map[project["team"]]
                row.track_id = track_map[project["track"]]
            else:
                row = Project(
                    fixture_id=project["id"],
                    title=project["title"],
                    summary=project["summary"],
                    repo_url=project["repo_url"],
                    status=ProjectStatus.SUBMITTED,
                    submitted_at=submitted_at,
                    team_id=team_map[project["team"]],
                    track_id=track_map[project["track"]],
                )
                db.add(row)
                db.flush()
            project_map[project["id"]] = row.id

        judge_track_map = {judge["id"]: set(judge["tracks"]) for judge in fixtures["judges"]}
        for project in fixtures["projects"]:
            for judge in fixtures["judges"]:
                if project["track"] not in judge_track_map[judge["id"]]:
                    continue
                assignment = (
                    db.query(JudgeAssignment)
                    .filter(
                        JudgeAssignment.judge_id == user_map[judge["id"]],
                        JudgeAssignment.project_id == project_map[project["id"]],
                    )
                    .first()
                )
                if not assignment:
                    db.add(
                        JudgeAssignment(
                            judge_id=user_map[judge["id"]],
                            project_id=project_map[project["id"]],
                        )
                    )

        for score in fixtures["scores"]:
            judge_id = user_map.get(score["judge"])
            project_id = project_map.get(score["project"])
            if not judge_id or not project_id:
                continue

            row = (
                db.query(Score)
                .filter(Score.judge_id == judge_id, Score.project_id == project_id)
                .first()
            )
            if row:
                row.criteria = score["criteria"]
                row.comment = score.get("comment") or ""
            else:
                db.add(
                    Score(
                        judge_id=judge_id,
                        project_id=project_id,
                        criteria=score["criteria"],
                        comment=score.get("comment") or "",
                    )
                )

        judge_a = user_map.get("jdg_01")
        judge_b = user_map.get("jdg_02")
        if not judge_a or not judge_b or not first_participant_id:
            raise RuntimeError("Failed to resolve seeded test users")

        upsert_session(db, TEST_SESSIONS["organizer"], organizer.id)
        upsert_session(db, TEST_SESSIONS["judge_a"], judge_a)
        upsert_session(db, TEST_SESSIONS["judge_b"], judge_b)
        upsert_session(db, TEST_SESSIONS["participant"], first_participant_id)

        db.commit()

        print("seeded. test logins:")
        print(f"  organizer    Cookie: session={TEST_SESSIONS['organizer']}")
        print(f"  judge_a      Cookie: session={TEST_SESSIONS['judge_a']}")
        print(f"  judge_b      Cookie: session={TEST_SESSIONS['judge_b']}")
        print(f"  participant  Cookie: session={TEST_SESSIONS['participant']}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
