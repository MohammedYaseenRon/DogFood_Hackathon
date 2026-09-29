"""CSV export at every stage of an event.

    registrations  who signed up, and their team
    teams          every team, its members and project status
    submissions    every project, drafts included, with all fields
    judges         the panel: scope and progress
    assignments    who was handed what, in which batch, scored or not
    scores         raw scores, one row per (judge, project)   <- default
    results        raw and normalized standings

Every cell that starts with a formula character is prefixed with a quote, so a
project title like `=HYPERLINK(...)` can't execute when an organizer opens the
file in a spreadsheet.
"""

import csv
import io
from collections.abc import Iterable

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session, joinedload

from app.auth import require_role
from app.database import get_db
from app.lib.scoring import weighted_total
from app.models import (
    EventRegistration,
    JudgeAssignment,
    Project,
    ProjectCustomAnswer,
    Role,
    Score,
    Team,
    TeamMember,
)
from app.services.events import iso, resolve_event
from app.services.judging import event_progress, event_results, event_rubric

router = APIRouter()

KINDS = ("registrations", "teams", "submissions", "judges", "assignments", "scores", "results")
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def safe_cell(value) -> object:
    if isinstance(value, str) and value.startswith(FORMULA_PREFIXES):
        return "'" + value
    return "" if value is None else value


def _csv(header: list[str], rows: Iterable[list]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(header)
    for row in rows:
        writer.writerow([safe_cell(value) for value in row])
    return buffer.getvalue()


def _scores_csv(db: Session, event) -> str:
    """One row per (judge, project). Criteria columns follow the event rubric,
    plus any extra criteria present in the scores themselves."""
    query = db.query(Score).options(
        joinedload(Score.project).joinedload(Project.track),
        joinedload(Score.project).joinedload(Project.team),
        joinedload(Score.judge),
    )
    rubric = []
    if event:
        query = query.join(Score.project).join(Project.team).filter(Team.event_id == event.id)
        rubric = event_rubric(db, event.id)
    scores = query.all()
    rubric_names = [c.name for c in rubric]
    extra = sorted({name for score in scores for name in (score.criteria or {})} - set(rubric_names))
    columns = rubric_names + extra

    def rows():
        for score in sorted(scores, key=lambda s: (s.project.fixture_id or "", s.judge.fixture_id or "")):
            criteria = score.criteria or {}
            yield [
                score.project.fixture_id or score.project_id,
                score.project.title,
                score.project.track.name if score.project.track else "",
                score.judge.fixture_id or score.judge.email,
                *[criteria.get(name, "") for name in columns],
                score.comment,
                weighted_total(criteria, rubric),
                iso(score.updated_at),
            ]

    return _csv(["project_id", "title", "track", "judge", *columns, "comment", "weighted_total", "updated_at"], rows())


def _registrations_csv(db: Session, event) -> str:
    registrations = (
        db.query(EventRegistration)
        .options(joinedload(EventRegistration.user))
        .filter(EventRegistration.event_id == event.id)
        .order_by(EventRegistration.registered_at.asc())
        .all()
    )
    team_of = {
        row.user_id: row.team.name
        for row in db.query(TeamMember)
        .options(joinedload(TeamMember.team))
        .join(TeamMember.team)
        .filter(Team.event_id == event.id)
    }
    return _csv(
        ["name", "email", "registered_at", "team"],
        (
            [r.user.name or "", r.user.email, iso(r.registered_at), team_of.get(r.user_id, "")]
            for r in registrations
        ),
    )


def _teams_csv(db: Session, event) -> str:
    teams = (
        db.query(Team)
        .options(joinedload(Team.members).joinedload(TeamMember.user), joinedload(Team.projects))
        .filter(Team.event_id == event.id)
        .order_by(Team.name.asc())
        .all()
    )
    return _csv(
        ["team_id", "team", "members", "member_emails", "size", "project_id", "project_status", "created_at"],
        (
            [
                team.fixture_id,
                team.name,
                "; ".join(m.user.name or m.user.email for m in team.members),
                "; ".join(m.user.email for m in team.members),
                len(team.members),
                team.projects[0].fixture_id if team.projects else "",
                team.projects[0].status.value if team.projects else "NOT_STARTED",
                iso(team.created_at),
            ]
            for team in teams
        ),
    )


def _submissions_csv(db: Session, event) -> str:
    projects = (
        db.query(Project)
        .options(
            joinedload(Project.team),
            joinedload(Project.track),
            joinedload(Project.custom_answers).joinedload(ProjectCustomAnswer.question),
        )
        .join(Project.team)
        .filter(Team.event_id == event.id)
        .order_by(Project.title.asc())
        .all()
    )
    questions = list(event.custom_questions)
    header = [
        "project_id", "title", "tagline", "team", "track", "status", "submitted_at", "updated_at",
        "repo_url", "live_url", "video_url", "thumbnail_url", "image_urls", "tech_tags", "description",
        *[f"q: {q.label}" for q in questions],
    ]

    def rows():
        for p in projects:
            answers = {a.question_id: a.answer for a in p.custom_answers}
            yield [
                p.fixture_id, p.title, p.tagline or "", p.team.name, p.track.name if p.track else "",
                p.status.value, iso(p.submitted_at), iso(p.updated_at),
                p.repo_url or "", p.live_url or "", p.video_url or p.demo_url or "", p.thumbnail_url or "",
                " ".join(p.image_urls or []), "; ".join(p.tech_tags or []), p.summary or "",
                *[answers.get(q.id, "") for q in questions],
            ]

    return _csv(header, rows())


def _judges_csv(db: Session, event) -> str:
    rows = event_progress(db, event)["judges"]
    return _csv(
        ["judge_id", "name", "email", "tracks", "assigned", "completed", "percent", "status", "last_activity"],
        (
            [
                r["id"], r["name"], r["email"], "; ".join(r["tracks"]) or "all tracks",
                r["assigned"], r["completed"], r["percent"], r["status"], r["lastActivity"],
            ]
            for r in rows
        ),
    )


def _assignments_csv(db: Session, event) -> str:
    rows = (
        db.query(JudgeAssignment)
        .options(joinedload(JudgeAssignment.judge), joinedload(JudgeAssignment.project).joinedload(Project.track))
        .join(JudgeAssignment.project)
        .join(Project.team)
        .filter(Team.event_id == event.id)
        .all()
    )
    scored = {(s.judge_id, s.project_id) for s in db.query(Score.judge_id, Score.project_id)}
    return _csv(
        ["judge_id", "judge", "project_id", "title", "track", "batch", "assigned_at", "scored"],
        (
            [
                a.judge.fixture_id or a.judge.email, a.judge.name or "", a.project.fixture_id, a.project.title,
                a.project.track.name if a.project.track else "", a.batch or "", iso(a.assigned_at),
                "yes" if (a.judge_id, a.project_id) in scored else "no",
            ]
            for a in sorted(rows, key=lambda a: (a.project.fixture_id or "", a.judge.fixture_id or ""))
        ),
    )


def _results_csv(db: Session, event) -> str:
    data = event_results(db, event)
    return _csv(
        [
            "rank", "track_rank", "raw_rank", "project_id", "title", "team", "track", "reviews",
            "raw_mean", "normalized", "disagreement", "low_confidence", "duplicate_of",
        ],
        (
            [
                r["rank"], r["trackRank"], r["rawRank"], r["projectId"], r["title"], r["teamName"], r["track"],
                r["reviews"], r["rawMean"], r["normalized"], r["disagreement"],
                "yes" if r["lowConfidence"] else "no", r["duplicateOf"],
            ]
            for r in data["projects"]
        ),
    )


BUILDERS = {
    "registrations": _registrations_csv,
    "teams": _teams_csv,
    "submissions": _submissions_csv,
    "judges": _judges_csv,
    "assignments": _assignments_csv,
    "results": _results_csv,
}


@router.get("/api/export.csv")
def export_csv(
    request: Request,
    event: str | None = None,
    kind: str = "scores",
    db: Session = Depends(get_db),
):
    require_role(db, request, [Role.ORGANIZER, Role.ADMIN])
    if kind not in KINDS:
        raise HTTPException(status_code=400, detail=f"kind must be one of: {', '.join(KINDS)}")

    if kind == "scores":
        # Without an event this stays the all-events score dump.
        target = resolve_event(db, event) if event else None
        body = _scores_csv(db, target)
    else:
        target = resolve_event(db, event)
        body = BUILDERS[kind](db, target)

    stem = f"{kind}-{target.slug}" if target else kind
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{stem}.csv"'},
    )
