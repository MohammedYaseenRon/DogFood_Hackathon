import json
import os
from datetime import datetime, timedelta
import re
from pathlib import Path

from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.models import (
    CustomQuestion,
    Event,
    JudgeAssignment,
    Prize,
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
)

from app.config import TEST_SESSIONS, seed_password
from app.services.passwords import hash_password

DEMO_EVENT_SLUG = "dogfood-open-hack"


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
    """The fixture event. Its deadline comes from fixtures.json (in the past), and
    the rest of its calendar is derived from it so the phases are coherent."""
    event_data = fixture["event"]
    event = db.query(Event).filter(Event.fixture_id == event_data["id"]).first()
    submissions_close = datetime.fromisoformat(
        event_data["submissions_close"].replace("Z", "+00:00")
    ).replace(tzinfo=None)

    slug = re.sub(r"[^a-z0-9]+", "-", event_data["name"].lower()).strip("-")
    calendar = {
        "registration_opens": submissions_close - timedelta(days=45),
        "registration_closes": submissions_close - timedelta(days=3),
        "event_starts": submissions_close - timedelta(days=3),
        "event_ends": submissions_close,
        "judging_starts": submissions_close + timedelta(hours=1),
        "judging_ends": submissions_close + timedelta(days=14),
        "results_at": submissions_close + timedelta(days=21),
    }

    if event is None:
        event = Event(fixture_id=event_data["id"])
        db.add(event)

    event.name = event_data["name"]
    event.slug = slug
    event.submissions_close = submissions_close
    event.description = (
        "The sample hackathon from the DOGFOOD fixture data: 40 teams, 8 tracks and "
        "30 judges. Submissions are closed, so this event is in its judging phase."
    )
    event.short_description = "Fixture event — submissions closed, judging underway."
    for field, value in calendar.items():
        setattr(event, field, value)
    event.max_team_size = 4
    event.published = True
    db.flush()
    return event


def get_or_create_demo_event(db: Session, organizer_id: str) -> Event:
    """An event that is open right now, so registration, teams and submissions
    can be tried end to end. Dates are set on first seed only; organizer edits
    survive later re-seeds."""
    event = db.query(Event).filter(Event.slug == DEMO_EVENT_SLUG).first()
    if event:
        return event

    now = datetime.utcnow().replace(second=0, microsecond=0)
    event = Event(
        fixture_id="evt_demo",
        slug=DEMO_EVENT_SLUG,
        name="Dogfood Open Hack",
        short_description="Open now — register, form a team and submit before the deadline.",
        description=(
            "A live demo event for trying the full participant flow: register, create "
            "a team, invite teammates with a link, save a draft and submit before the "
            "deadline. Organizers can change any of these dates from the event settings."
        ),
        registration_opens=now - timedelta(days=7),
        registration_closes=now + timedelta(days=28),
        event_starts=now - timedelta(days=1),
        event_ends=now + timedelta(days=30),
        submissions_close=now + timedelta(days=30),
        judging_starts=now + timedelta(days=30, hours=1),
        judging_ends=now + timedelta(days=40),
        results_at=now + timedelta(days=45),
        max_team_size=4,
        published=True,
        created_by=organizer_id,
    )
    db.add(event)
    db.flush()

    tracks = []
    for index, (name, description) in enumerate(
        [
            ("Developer tools", "Make building software faster or safer."),
            ("Accessibility", "Tools that make the web usable by everyone."),
            ("Open data", "Put public datasets to work."),
        ]
    ):
        track = Track(
            fixture_id=f"trk_demo_{index + 1}",
            name=name,
            description=description,
            display_order=index,
            event_id=event.id,
        )
        db.add(track)
        tracks.append(track)
    db.flush()

    db.add_all(
        [
            Prize(event_id=event.id, name="Grand prize", amount="$1,000", rank=1),
            Prize(event_id=event.id, name="Best accessibility hack", amount="$250", rank=2, track_id=tracks[1].id),
        ]
    )
    for name in ("functionality", "quality", "innovation"):
        db.add(RubricCriterion(event_id=event.id, name=name, weight=1.0))
    db.add_all(
        [
            CustomQuestion(
                event_id=event.id,
                label="What did you build during the event (vs. before it)?",
                question_type="textarea",
                required=True,
                display_order=0,
            ),
            CustomQuestion(
                event_id=event.id,
                label="Primary platform",
                question_type="select",
                required=False,
                options=["Web", "Mobile", "CLI", "Other"],
                display_order=1,
            ),
        ]
    )
    db.flush()
    return event


def ensure_demo_password(user: User) -> None:
    if not user.password_hash:
        user.password_hash = hash_password(seed_password())


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

        default_prizes = [
            ("Grand prize", "$2,500", 1, None),
            ("Best developer tools", "$500", 2, "trk_01"),
            ("Best accessibility hack", "$500", 3, "trk_03"),
        ]
        for prize_name, amount, rank, track_fixture in default_prizes:
            existing_prize = (
                db.query(Prize)
                .filter(Prize.event_id == event.id, Prize.name == prize_name)
                .first()
            )
            if existing_prize:
                continue
            track_id = track_map.get(track_fixture) if track_fixture else None
            db.add(
                Prize(
                    event_id=event.id,
                    name=prize_name,
                    amount=amount,
                    rank=rank,
                    track_id=track_id,
                )
            )

        user_map: dict[str, str] = {}

        admin = get_or_create_user(
            db,
            "admin@dogfood.local",
            role=Role.ADMIN,
            name="Platform Admin",
            fixture_id="adm_01",
        )
        user_map["admin@dogfood.local"] = admin.id

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

            owner_id: str | None = None
            for index, member_email in enumerate(team["members"]):
                participant = get_or_create_user(db, member_email, role=Role.PARTICIPANT)
                user_map[member_email] = participant.id
                if first_participant_id is None:
                    first_participant_id = participant.id
                if index == 0:
                    owner_id = participant.id

                membership = (
                    db.query(TeamMember)
                    .filter(TeamMember.team_id == row.id, TeamMember.user_id == participant.id)
                    .first()
                )
                if not membership:
                    db.add(
                        TeamMember(
                            team_id=row.id,
                            user_id=participant.id,
                            role=TeamMemberRole.OWNER
                            if index == 0
                            else TeamMemberRole.MEMBER,
                        )
                    )
                elif index == 0:
                    membership.role = TeamMemberRole.OWNER

            if owner_id and not row.created_by:
                row.created_by = owner_id

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

        get_or_create_demo_event(db, organizer.id)

        demo_accounts = [admin, organizer, db.get(User, judge_a), db.get(User, judge_b), db.get(User, first_participant_id)]
        for account in demo_accounts:
            ensure_demo_password(account)

        upsert_session(db, TEST_SESSIONS["organizer"], organizer.id)
        upsert_session(db, TEST_SESSIONS["judge_a"], judge_a)
        upsert_session(db, TEST_SESSIONS["judge_b"], judge_b)
        upsert_session(db, TEST_SESSIONS["participant"], first_participant_id)
        upsert_session(db, TEST_SESSIONS["admin"], admin.id)

        db.commit()

        print("seeded. test logins:")
        print(f"  organizer    Cookie: session={TEST_SESSIONS['organizer']}")
        print(f"  judge_a      Cookie: session={TEST_SESSIONS['judge_a']}")
        print(f"  judge_b      Cookie: session={TEST_SESSIONS['judge_b']}")
        print(f"  participant  Cookie: session={TEST_SESSIONS['participant']}")
        print(f"  admin        Cookie: session={TEST_SESSIONS['admin']}")
        print("email logins (password from SEED_PASSWORD, default 'dogfood-demo'):")
        for account in demo_accounts:
            print(f"  {account.role.value.lower():<12} {account.email}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
