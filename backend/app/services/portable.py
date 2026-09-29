"""Move a whole event in and out of the portal as one JSON file.

The format is `fixtures.json` extended: every key the fixture file has means the
same thing here, so the official fixtures (or anything another tool can write
in that shape) import as-is, and an export from here can seed a fresh install.

    {
      "format": "hackboard-event/1",
      "event":       {id, name, slug, description, submissions_close, ...calendar},
      "tracks":      [{id, name, description}],
      "rubric":      [{name, weight, description}],             # optional
      "judges":      [{id, name, email, tracks}],
      "teams":       [{id, name, members: [email]}],
      "projects":    [{id, team, track, title, summary, repo_url, submitted_at,
                       status, tagline, demo_url, video_url, tech_tags, ...}],
      "assignments": [{judge, project, batch}],                  # optional
      "scores":      [{judge, project, criteria, comment}]
    }

Ids are the portable `fixture_id`s, never database keys, so importing the same
file twice updates rows instead of duplicating them. Community votes, comments
and the audit trail are left out on purpose: they hold voters' personal data
and are exported separately as CSV.
"""

from datetime import datetime

from sqlalchemy.orm import Session, joinedload

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
    Team,
    TeamMember,
    TeamMemberRole,
    Track,
    User,
    new_id,
)
from app.services.events import ensure_registration, iso

FORMAT = "hackboard-event/1"
CALENDAR = (
    "registration_opens", "registration_closes", "event_starts", "event_ends",
    "judging_starts", "judging_ends", "results_at",
)
PROJECT_FIELDS = ("tagline", "demo_url", "live_url", "video_url", "thumbnail_url", "image_urls", "tech_tags")
# Importing never demotes: an organizer listed as a team member stays an organizer.
ROLE_RANK = {Role.VISITOR: 0, Role.PARTICIPANT: 1, Role.JUDGE: 2, Role.ORGANIZER: 3, Role.ADMIN: 4}


class ImportError_(ValueError):
    """The file can't be imported; `problems` lists every reason, not just the first."""

    def __init__(self, problems: list[str]):
        super().__init__("; ".join(problems))
        self.problems = problems


# --------------------------------------------------------------------------
# Export
# --------------------------------------------------------------------------


def export_event(db: Session, event: Event) -> dict:
    tracks = db.query(Track).filter(Track.event_id == event.id).order_by(Track.display_order).all()
    track_ref = {t.id: t.fixture_id for t in tracks}
    teams = (
        db.query(Team)
        .options(joinedload(Team.members).joinedload(TeamMember.user))
        .filter(Team.event_id == event.id)
        .all()
    )
    team_ref = {t.id: t.fixture_id for t in teams}
    projects = db.query(Project).filter(Project.team_id.in_(team_ref)).all() if team_ref else []
    project_ref = {p.id: p.fixture_id for p in projects}

    seats = (
        db.query(EventJudge)
        .options(joinedload(EventJudge.user), joinedload(EventJudge.tracks))
        .filter(EventJudge.event_id == event.id)
        .all()
    )
    assignments = (
        db.query(JudgeAssignment).filter(JudgeAssignment.project_id.in_(project_ref)).all()
        if project_ref else []
    )
    scores = db.query(Score).filter(Score.project_id.in_(project_ref)).all() if project_ref else []

    # Anyone who assigned or scored is a judge of this event, seated or not.
    judge_users = {seat.user_id: seat.user for seat in seats}
    for user_id in {a.judge_id for a in assignments} | {s.judge_id for s in scores}:
        if user_id not in judge_users:
            judge_users[user_id] = db.get(User, user_id)
    seat_tracks = {seat.user_id: seat.track_ids for seat in seats}

    def judge_ref(user: User) -> str:
        return user.fixture_id or user.email

    def ordered(rows, key):
        return sorted(rows, key=key)

    return {
        "format": FORMAT,
        "exported_at": iso(datetime.utcnow()),
        "event": {
            "id": event.fixture_id,
            "name": event.name,
            "slug": event.slug,
            "description": event.description,
            "short_description": event.short_description,
            "submissions_close": iso(event.submissions_close),
            **{field: iso(getattr(event, field)) for field in CALENDAR},
            "max_team_size": event.max_team_size,
            "published": event.published,
        },
        "tracks": [
            {"id": t.fixture_id, "name": t.name, "description": t.description} for t in tracks
        ],
        "rubric": [
            {"name": c.name, "weight": c.weight, "description": c.description}
            for c in ordered(event.rubric, lambda c: c.display_order)
        ],
        "judges": [
            {
                "id": judge_ref(user),
                "name": user.name,
                "email": user.email,
                "tracks": sorted(track_ref[t] for t in seat_tracks.get(user.id, ()) if t in track_ref),
            }
            for user in ordered(judge_users.values(), lambda u: judge_ref(u))
        ],
        "teams": [
            {
                "id": t.fixture_id,
                "name": t.name,
                "description": t.description,
                # Owner first, as in fixtures.json.
                "members": [
                    m.user.email
                    for m in sorted(t.members, key=lambda m: (m.role != TeamMemberRole.OWNER, m.user.email))
                ],
            }
            for t in ordered(teams, lambda t: t.fixture_id)
        ],
        "projects": [
            {
                "id": p.fixture_id,
                "team": team_ref[p.team_id],
                "track": track_ref.get(p.track_id),
                "title": p.title,
                "summary": p.summary,
                "repo_url": p.repo_url,
                "submitted_at": iso(p.submitted_at),
                "status": p.status.value.lower(),
                **{field: getattr(p, field) for field in PROJECT_FIELDS},
            }
            for p in ordered(projects, lambda p: p.fixture_id)
        ],
        "assignments": [
            {"judge": judge_ref(judge_users[a.judge_id]), "project": project_ref[a.project_id], "batch": a.batch}
            for a in ordered(assignments, lambda a: (project_ref[a.project_id], judge_ref(judge_users[a.judge_id])))
        ],
        "scores": [
            {
                "judge": judge_ref(judge_users[s.judge_id]),
                "project": project_ref[s.project_id],
                "criteria": s.criteria,
                "comment": s.comment or "",
            }
            for s in ordered(scores, lambda s: (project_ref[s.project_id], judge_ref(judge_users[s.judge_id])))
        ],
    }


# --------------------------------------------------------------------------
# Import
# --------------------------------------------------------------------------


def _when(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)


def validate(data: dict) -> list[str]:
    """Every problem in the file, with where it is, before anything is written."""
    problems: list[str] = []
    if not isinstance(data, dict):
        return ["The file must be a JSON object."]
    fmt = data.get("format")
    if fmt is not None and fmt != FORMAT:
        problems.append(f"Unknown format {fmt!r}; expected {FORMAT!r}.")
    event = data.get("event")
    if not isinstance(event, dict) or not event.get("id") or not event.get("name"):
        problems.append("event: needs at least an id and a name.")
    else:
        for field in ("submissions_close", *CALENDAR):
            try:
                _when(event.get(field))
            except (TypeError, ValueError):
                problems.append(f"event.{field}: not an ISO 8601 date.")
        if not event.get("submissions_close"):
            problems.append("event.submissions_close: required.")

    def section(name: str) -> list:
        rows = data.get(name, [])
        if not isinstance(rows, list):
            problems.append(f"{name}: must be a list.")
            return []
        return rows

    tracks = {row.get("id") for row in section("tracks") if isinstance(row, dict)}
    teams = {row.get("id") for row in section("teams") if isinstance(row, dict)}
    judges = {row.get("id") for row in section("judges") if isinstance(row, dict)}

    for i, row in enumerate(section("tracks")):
        if not isinstance(row, dict) or not row.get("id") or not row.get("name"):
            problems.append(f"tracks[{i}]: needs an id and a name.")
    for i, row in enumerate(section("rubric")):
        if not isinstance(row, dict) or not row.get("name"):
            problems.append(f"rubric[{i}]: needs a name.")
        elif not isinstance(row.get("weight", 1), (int, float)) or row.get("weight", 1) <= 0:
            problems.append(f"rubric[{i}] ({row['name']}): weight must be a positive number.")
    for i, row in enumerate(section("judges")):
        if not isinstance(row, dict) or not row.get("id") or "@" not in str(row.get("email", "")):
            problems.append(f"judges[{i}]: needs an id and an email.")
            continue
        for track in row.get("tracks", []):
            if track not in tracks:
                problems.append(f"judges[{i}] ({row['id']}): unknown track {track!r}.")
    for i, row in enumerate(section("teams")):
        if not isinstance(row, dict) or not row.get("id") or not row.get("name"):
            problems.append(f"teams[{i}]: needs an id and a name.")
            continue
        for email in row.get("members", []):
            if "@" not in str(email):
                problems.append(f"teams[{i}] ({row['id']}): {email!r} is not an email.")
    projects = set()
    for i, row in enumerate(section("projects")):
        if not isinstance(row, dict) or not row.get("id") or not row.get("title"):
            problems.append(f"projects[{i}]: needs an id and a title.")
            continue
        projects.add(row["id"])
        if row.get("team") not in teams:
            problems.append(f"projects[{i}] ({row['id']}): unknown team {row.get('team')!r}.")
        if row.get("track") not in tracks:
            problems.append(f"projects[{i}] ({row['id']}): unknown track {row.get('track')!r}.")
        try:
            _when(row.get("submitted_at"))
        except (TypeError, ValueError):
            problems.append(f"projects[{i}] ({row['id']}): submitted_at is not an ISO 8601 date.")
    for name in ("assignments", "scores"):
        for i, row in enumerate(section(name)):
            if not isinstance(row, dict):
                problems.append(f"{name}[{i}]: must be an object.")
                continue
            if row.get("judge") not in judges:
                problems.append(f"{name}[{i}]: unknown judge {row.get('judge')!r}.")
            if row.get("project") not in projects:
                problems.append(f"{name}[{i}]: unknown project {row.get('project')!r}.")
            if name == "scores":
                criteria = row.get("criteria")
                if not isinstance(criteria, dict) or not all(
                    isinstance(v, (int, float)) and 1 <= v <= 5 for v in criteria.values()
                ):
                    problems.append(f"scores[{i}]: criteria must map names to scores from 1 to 5.")
    return problems


def conflicts(db: Session, data: dict) -> list[str]:
    """Ids already used by a *different* event. Re-importing an event's own file
    updates it; a file that reuses another event's ids is refused, never merged."""
    event = db.query(Event).filter(Event.fixture_id == data["event"]["id"]).first()
    event_id = event.id if event else None
    problems = []
    for name, model, owner in (
        ("tracks", Track, lambda row: row.event_id),
        ("teams", Team, lambda row: row.event_id),
        ("projects", Project, lambda row: row.team.event_id),
    ):
        ids = [row["id"] for row in data.get(name, [])]
        if not ids:
            continue
        for row in db.query(model).filter(model.fixture_id.in_(ids)).all():
            if owner(row) != event_id:
                problems.append(f"{name}: id {row.fixture_id!r} already belongs to another event.")
    return problems


def summarize(data: dict) -> dict:
    return {
        "event": (data.get("event") or {}).get("name"),
        **{name: len(data.get(name) or []) for name in ("tracks", "rubric", "judges", "teams", "projects", "assignments", "scores")},
    }


def _user(db: Session, email: str, role: Role, *, name: str | None = None, fixture_id: str | None = None) -> User:
    email = email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(email=email, role=role, name=name)
        db.add(user)
    elif ROLE_RANK[user.role] < ROLE_RANK[role]:
        user.role = role
    if name and not user.name:
        user.name = name
    if fixture_id and not user.fixture_id and not db.query(User).filter(User.fixture_id == fixture_id).first():
        user.fixture_id = fixture_id
    db.flush()
    return user


def _upsert(db: Session, model, fixture_id: str, **values):
    row = db.query(model).filter(model.fixture_id == fixture_id).first()
    if row is None:
        row = model(fixture_id=fixture_id)
        db.add(row)
    for key, value in values.items():
        setattr(row, key, value)
    db.flush()
    return row


def import_event(db: Session, data: dict, *, actor: User | None = None) -> Event:
    """Create or update the event described by `data`. Raises ImportError_ with
    every problem if the file is invalid; nothing is written in that case."""
    problems = validate(data) or conflicts(db, data)
    if problems:
        raise ImportError_(problems)

    e = data["event"]
    slug = e.get("slug") or "-".join("".join(c if c.isalnum() else " " for c in e["name"].lower()).split())
    taken = db.query(Event).filter(Event.slug == slug, Event.fixture_id != e["id"]).first()
    if taken:
        slug = f"{slug}-{new_id()[:6]}"
    event = _upsert(
        db, Event, e["id"],
        name=e["name"],
        slug=slug,
        description=e.get("description"),
        short_description=e.get("short_description"),
        submissions_close=_when(e["submissions_close"]),
        max_team_size=e.get("max_team_size") or 4,
        published=e.get("published", True),
        **{field: _when(e.get(field)) for field in CALENDAR if field in e},
    )
    if actor and not event.created_by:
        event.created_by = actor.id

    tracks = {}
    for order, t in enumerate(data.get("tracks", [])):
        tracks[t["id"]] = _upsert(
            db, Track, t["id"], name=t["name"], description=t.get("description"),
            display_order=order, event_id=event.id,
        )

    # The rubric: explicit if given, otherwise every criterion the scores use.
    rubric = data.get("rubric") or [
        {"name": name}
        for name in sorted({c for s in data.get("scores", []) for c in s["criteria"]})
    ]
    for order, c in enumerate(rubric):
        row = (
            db.query(RubricCriterion)
            .filter(RubricCriterion.event_id == event.id, RubricCriterion.name == c["name"])
            .first()
        )
        if row is None:
            row = RubricCriterion(event_id=event.id, name=c["name"])
            db.add(row)
        row.weight = float(c.get("weight", 1.0))
        row.description = c.get("description") or row.description
        row.display_order = order

    judges: dict[str, User] = {}
    for j in data.get("judges", []):
        user = _user(db, j["email"], Role.JUDGE, name=j.get("name"),
                     fixture_id=j["id"] if "@" not in j["id"] else None)
        judges[j["id"]] = user
        seat = (
            db.query(EventJudge)
            .filter(EventJudge.event_id == event.id, EventJudge.user_id == user.id)
            .first()
        )
        if seat is None:
            seat = EventJudge(event_id=event.id, user_id=user.id, invited_by=actor.id if actor else None)
            db.add(seat)
            db.flush()
        want = {tracks[t].id for t in j.get("tracks", [])}
        for row in list(seat.tracks):
            if row.track_id not in want:
                seat.tracks.remove(row)
        have = seat.track_ids
        for track_id in want - have:
            seat.tracks.append(EventJudgeTrack(track_id=track_id))

    teams = {}
    for t in data.get("teams", []):
        team = _upsert(db, Team, t["id"], name=t["name"], description=t.get("description"), event_id=event.id)
        teams[t["id"]] = team
        for index, email in enumerate(t.get("members", [])):
            user = _user(db, email, Role.PARTICIPANT)
            membership = (
                db.query(TeamMember)
                .filter(TeamMember.team_id == team.id, TeamMember.user_id == user.id)
                .first()
            )
            if membership is None:
                db.add(TeamMember(
                    team_id=team.id, user_id=user.id,
                    role=TeamMemberRole.OWNER if index == 0 else TeamMemberRole.MEMBER,
                ))
            if index == 0 and not team.created_by:
                team.created_by = user.id
            # Being on a team means having registered, as in the seed.
            ensure_registration(db, event, user)

    projects = {}
    for p in data.get("projects", []):
        status = str(p.get("status") or "submitted").upper()
        submitted_at = _when(p.get("submitted_at"))
        projects[p["id"]] = _upsert(
            db, Project, p["id"],
            title=p["title"],
            summary=p.get("summary") or "",
            repo_url=p.get("repo_url") or "",
            status=ProjectStatus.DRAFT if status == "DRAFT" else ProjectStatus.SUBMITTED,
            submitted_at=submitted_at,
            team_id=teams[p["team"]].id,
            track_id=tracks[p["track"]].id,
            **{field: p[field] for field in PROJECT_FIELDS if field in p},
        )

    for a in data.get("assignments", []):
        judge_id, project_id = judges[a["judge"]].id, projects[a["project"]].id
        row = (
            db.query(JudgeAssignment)
            .filter(JudgeAssignment.judge_id == judge_id, JudgeAssignment.project_id == project_id)
            .first()
        )
        if row is None:
            db.add(JudgeAssignment(
                judge_id=judge_id, project_id=project_id, batch=a.get("batch", "import"),
                assigned_by=actor.id if actor else None,
            ))

    for s in data.get("scores", []):
        judge_id, project_id = judges[s["judge"]].id, projects[s["project"]].id
        row = db.query(Score).filter(Score.judge_id == judge_id, Score.project_id == project_id).first()
        if row is None:
            db.add(Score(judge_id=judge_id, project_id=project_id,
                         criteria=s["criteria"], comment=s.get("comment") or ""))
        else:
            row.criteria = s["criteria"]
            row.comment = s.get("comment") or ""

    db.flush()
    return event
