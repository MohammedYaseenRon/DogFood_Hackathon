"""Judging rules: who sits on a panel, what a judge may see, who gets assigned what.

Every judge-facing read and write goes through `judge_can_access_project` (or the
queries built from the same rules), so role isolation lives in one place in the
backend instead of being painted on in the UI:

* a judge only sees projects they are *assigned* to,
* on an event whose panel they *sit on*,
* inside the tracks their seat is *scoped to* (no tracks = the whole event),
* and only once the project is *submitted* (drafts stay with the team).

Scores are never read across judges: every score query filters on the caller.
"""

from __future__ import annotations

import hashlib
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.lib.scoring import weighted_total
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
    Track,
    User,
)
from app.services.normalization import (
    METHOD,
    Review,
    competition_ranks,
    normalize,
)

# --------------------------------------------------------------------------
# Panel seats and scope
# --------------------------------------------------------------------------


def panel_seat(db: Session, event_id: str, user_id: str) -> EventJudge | None:
    return (
        db.query(EventJudge)
        .options(joinedload(EventJudge.tracks))
        .filter(EventJudge.event_id == event_id, EventJudge.user_id == user_id)
        .first()
    )


def panel(db: Session, event: Event) -> list[EventJudge]:
    return (
        db.query(EventJudge)
        .options(joinedload(EventJudge.tracks), joinedload(EventJudge.user))
        .filter(EventJudge.event_id == event.id)
        .all()
    )


def in_scope(seat: EventJudge, project: Project) -> bool:
    scope = seat.track_ids
    return not scope or project.track_id in scope


def is_conflicted(db: Session, user_id: str, project: Project) -> bool:
    """A judge never scores a team they belong to."""
    return (
        db.query(TeamMember)
        .filter(TeamMember.team_id == project.team_id, TeamMember.user_id == user_id)
        .first()
        is not None
    )


def ineligible_reason(db: Session, seat: EventJudge, project: Project) -> str | None:
    """Why this judge can't be assigned this project, or None if they can."""
    if project.status != ProjectStatus.SUBMITTED:
        return "project is a draft"
    if project.team.event_id != seat.event_id:
        return "project is in another event"
    if not in_scope(seat, project):
        return "project is outside the judge's tracks"
    if is_conflicted(db, seat.user_id, project):
        return "judge is a member of this team"
    return None


def judge_can_access_project(db: Session, user: User | None, project: Project) -> bool:
    if not user or user.role != Role.JUDGE or project.status != ProjectStatus.SUBMITTED:
        return False
    assigned = (
        db.query(JudgeAssignment)
        .filter(JudgeAssignment.judge_id == user.id, JudgeAssignment.project_id == project.id)
        .first()
    )
    if not assigned:
        return False
    seat = panel_seat(db, project.team.event_id, user.id)
    return bool(seat and in_scope(seat, project))


def visible_assignments(db: Session, user: User, event_id: str | None = None) -> list[JudgeAssignment]:
    """The caller's assignments that pass every isolation rule."""
    seats = {seat.event_id: seat for seat in db.query(EventJudge).options(joinedload(EventJudge.tracks)).filter(EventJudge.user_id == user.id)}
    query = (
        db.query(JudgeAssignment)
        .options(
            joinedload(JudgeAssignment.project).joinedload(Project.track),
            joinedload(JudgeAssignment.project).joinedload(Project.team).joinedload(Team.event),
        )
        .join(JudgeAssignment.project)
        .join(Project.team)
        .filter(JudgeAssignment.judge_id == user.id, Project.status == ProjectStatus.SUBMITTED)
    )
    if event_id:
        query = query.filter(Team.event_id == event_id)
    visible = []
    for assignment in query.all():
        seat = seats.get(assignment.project.team.event_id)
        if seat and in_scope(seat, assignment.project):
            visible.append(assignment)
    return visible


def seat_on_panel(
    db: Session,
    event: Event,
    user: User,
    track_ids: list[str],
    invited_by: str | None,
) -> EventJudge:
    seat = panel_seat(db, event.id, user.id)
    if not seat:
        seat = EventJudge(event_id=event.id, user_id=user.id, invited_by=invited_by)
        db.add(seat)
        db.flush()
    set_seat_tracks(db, seat, track_ids)
    return seat


def set_seat_tracks(db: Session, seat: EventJudge, track_ids: list[str]) -> None:
    wanted = set(track_ids)
    for row in list(seat.tracks):
        if row.track_id not in wanted:
            seat.tracks.remove(row)
    have = seat.track_ids
    for track_id in wanted - have:
        seat.tracks.append(EventJudgeTrack(track_id=track_id))
    db.flush()


def resolve_tracks(db: Session, event: Event, refs: list[str]) -> list[Track]:
    """Track refs (fixture id or internal id) that belong to this event."""
    if not refs:
        return []
    tracks = (
        db.query(Track)
        .filter(Track.event_id == event.id)
        .filter(Track.fixture_id.in_(refs) | Track.id.in_(refs))
        .all()
    )
    if len(tracks) != len(set(refs)):
        raise HTTPException(status_code=400, detail="One or more tracks are not part of this event")
    return tracks


# --------------------------------------------------------------------------
# Rubric
# --------------------------------------------------------------------------


def event_rubric(db: Session, event_id: str) -> list[RubricCriterion]:
    return (
        db.query(RubricCriterion)
        .filter(RubricCriterion.event_id == event_id)
        .order_by(RubricCriterion.display_order.asc(), RubricCriterion.name.asc())
        .all()
    )


def serialize_criterion(item: RubricCriterion) -> dict:
    return {"name": item.name, "description": item.description, "weight": item.weight}


def event_has_scores(db: Session, event: Event) -> bool:
    return (
        db.query(Score.id)
        .join(Score.project)
        .join(Project.team)
        .filter(Team.event_id == event.id)
        .first()
        is not None
    )


# --------------------------------------------------------------------------
# Assignment
# --------------------------------------------------------------------------


def event_projects(db: Session, event: Event, *, submitted_only: bool = True) -> list[Project]:
    query = (
        db.query(Project)
        .options(joinedload(Project.track), joinedload(Project.team))
        .join(Project.team)
        .filter(Team.event_id == event.id)
    )
    if submitted_only:
        query = query.filter(Project.status == ProjectStatus.SUBMITTED)
    return query.all()


def duplicate_map(projects: list[Project]) -> dict[str, str]:
    """{superseded project id: kept project id}.

    A team that submitted the same project twice (same title or repo) is judged
    on its latest submission; earlier copies are kept for the record but are not
    ranked or auto-assigned.
    """
    groups: dict[tuple[str, str], list[Project]] = defaultdict(list)
    for project in projects:
        title = (project.title or "").strip().casefold()
        repo = (project.repo_url or "").strip().rstrip("/").casefold()
        if title:
            groups[(project.team_id, "t:" + title)].append(project)
        if repo:
            groups[(project.team_id, "r:" + repo)].append(project)

    superseded: dict[str, str] = {}
    for items in groups.values():
        unique = {p.id: p for p in items}
        if len(unique) < 2:
            continue
        ordered = sorted(unique.values(), key=lambda p: (p.submitted_at or datetime.min, p.id))
        keeper = ordered[-1]
        for project in ordered[:-1]:
            superseded[project.id] = keeper.id
    return superseded


def _tiebreak(judge_id: str, project_id: str) -> str:
    # Deterministic but not alphabetical, so the same judges don't always win ties.
    return hashlib.sha256(f"{judge_id}:{project_id}".encode()).hexdigest()


@dataclass
class AssignmentPlan:
    pairs: list[tuple[EventJudge, Project]] = field(default_factory=list)
    shortfalls: list[dict] = field(default_factory=list)
    load: dict[str, int] = field(default_factory=dict)


def plan_auto_assignment(
    db: Session,
    event: Event,
    *,
    reviews_per_project: int,
    max_per_judge: int | None = None,
) -> AssignmentPlan:
    """Top every submitted project up to `reviews_per_project` eligible judges.

    Greedy, scarcity first: projects with the fewest eligible judges are filled
    first so a narrow track isn't starved by judges spent elsewhere. Among the
    eligible judges the least-loaded one is picked, ties broken by a stable hash.
    Existing assignments count toward both targets, so running it again only
    fills gaps.
    """
    seats = panel(db, event)
    projects = event_projects(db, event)
    superseded = duplicate_map(projects)
    projects = [p for p in projects if p.id not in superseded]

    existing = defaultdict(set)
    load: dict[str, int] = defaultdict(int)
    project_ids = {p.id for p in projects}
    for assignment in (
        db.query(JudgeAssignment)
        .join(JudgeAssignment.project)
        .join(Project.team)
        .filter(Team.event_id == event.id)
    ):
        existing[assignment.project_id].add(assignment.judge_id)
        load[assignment.judge_id] += 1

    conflicts = {
        (row.user_id, row.team_id)
        for row in db.query(TeamMember.user_id, TeamMember.team_id).filter(
            TeamMember.user_id.in_([s.user_id for s in seats] or [""])
        )
    }

    def eligible(project: Project) -> list[EventJudge]:
        return [
            seat
            for seat in seats
            if in_scope(seat, project)
            and (seat.user_id, project.team_id) not in conflicts
            and seat.user_id not in existing[project.id]
        ]

    plan = AssignmentPlan()
    order = sorted(
        (p for p in projects if p.id in project_ids),
        key=lambda p: (len(eligible(p)), len(existing[p.id]), p.fixture_id or p.id),
    )
    for project in order:
        need = reviews_per_project - len(existing[project.id])
        if need <= 0:
            continue
        candidates = [
            seat
            for seat in eligible(project)
            if max_per_judge is None or load[seat.user_id] < max_per_judge
        ]
        candidates.sort(key=lambda seat: (load[seat.user_id], _tiebreak(seat.user_id, project.id)))
        chosen = candidates[:need]
        for seat in chosen:
            plan.pairs.append((seat, project))
            existing[project.id].add(seat.user_id)
            load[seat.user_id] += 1
        if len(chosen) < need:
            plan.shortfalls.append(
                {
                    "projectId": project.fixture_id or project.id,
                    "title": project.title,
                    "track": project.track.name if project.track else None,
                    "wanted": reviews_per_project,
                    "have": len(existing[project.id]),
                }
            )
    plan.load = {seat.user_id: load[seat.user_id] for seat in seats}
    return plan


def create_assignment(
    db: Session, seat: EventJudge, project: Project, *, batch: str | None, actor_id: str | None
) -> JudgeAssignment | None:
    exists = (
        db.query(JudgeAssignment)
        .filter(JudgeAssignment.judge_id == seat.user_id, JudgeAssignment.project_id == project.id)
        .first()
    )
    if exists:
        return None
    assignment = JudgeAssignment(
        judge_id=seat.user_id,
        project_id=project.id,
        batch=batch,
        assigned_by=actor_id,
        assigned_at=datetime.utcnow(),
    )
    db.add(assignment)
    return assignment


# --------------------------------------------------------------------------
# Progress
# --------------------------------------------------------------------------


def judge_status(assigned: int, completed: int) -> str:
    if assigned == 0:
        return "unassigned"
    if completed == 0:
        return "not_started"
    if completed >= assigned:
        return "done"
    return "in_progress"


def event_progress(db: Session, event: Event) -> dict:
    seats = panel(db, event)
    assignments = (
        db.query(JudgeAssignment)
        .join(JudgeAssignment.project)
        .join(Project.team)
        .filter(Team.event_id == event.id, Project.status == ProjectStatus.SUBMITTED)
        .all()
    )
    scores = (
        db.query(Score)
        .join(Score.project)
        .join(Project.team)
        .filter(Team.event_id == event.id)
        .all()
    )
    scored = {(s.judge_id, s.project_id): s for s in scores}
    tracks = {t.id: t for t in event.tracks}

    rows = []
    for seat in seats:
        mine = [a for a in assignments if a.judge_id == seat.user_id]
        done = [a for a in mine if (seat.user_id, a.project_id) in scored]
        activity = [scored[(seat.user_id, a.project_id)].updated_at for a in done]
        activity = [t for t in activity if t]
        user = seat.user
        rows.append(
            {
                "id": user.fixture_id or user.id,
                "userId": user.id,
                "name": user.name or user.email,
                "email": user.email,
                "tracks": sorted(tracks[t].name for t in seat.track_ids if t in tracks),
                "trackIds": sorted(tracks[t].fixture_id for t in seat.track_ids if t in tracks),
                "assigned": len(mine),
                "completed": len(done),
                "remaining": len(mine) - len(done),
                "percent": round(len(done) / len(mine) * 100, 1) if mine else 0,
                "status": judge_status(len(mine), len(done)),
                "lastActivity": (max(activity).isoformat() + "Z") if activity else None,
            }
        )
    rows.sort(key=lambda r: (r["percent"], r["name"]))

    reviews_by_project = defaultdict(lambda: [0, 0])
    for assignment in assignments:
        entry = reviews_by_project[assignment.project_id]
        entry[0] += 1
        if (assignment.judge_id, assignment.project_id) in scored:
            entry[1] += 1

    total = len(assignments)
    completed = sum(r["completed"] for r in rows)
    return {
        "judges": rows,
        "totals": {
            "panel": len(seats),
            "assignments": total,
            "completed": completed,
            "remaining": total - completed,
            "percent": round(completed / total * 100, 1) if total else 0.0,
            "notStarted": sum(1 for r in rows if r["status"] == "not_started"),
            "done": sum(1 for r in rows if r["status"] == "done"),
            "unassigned": sum(1 for r in rows if r["status"] == "unassigned"),
            "projectsWithoutReviews": sum(1 for v in reviews_by_project.values() if v[1] == 0),
        },
    }


# --------------------------------------------------------------------------
# Results
# --------------------------------------------------------------------------


def event_results(db: Session, event: Event) -> dict:
    """Raw and normalized standings for every submitted project."""
    rubric = event_rubric(db, event.id)
    projects = event_projects(db, event)
    by_id = {p.id: p for p in projects}
    superseded = duplicate_map(projects)

    scores = (
        db.query(Score)
        .join(Score.project)
        .join(Project.team)
        .filter(Team.event_id == event.id, Project.status == ProjectStatus.SUBMITTED)
        .all()
    )
    # Superseded duplicates still calibrate their judges (the scores are real
    # opinions) but are not ranked.
    reviews = [Review(s.judge_id, s.project_id, weighted_total(s.criteria or {}, rubric)) for s in scores]
    result = normalize(reviews)

    judges = {
        u.id: u
        for u in db.query(User).filter(User.id.in_(list(result.judges) or [""]))
    }

    rows = []
    for project in projects:
        stats = result.projects.get(project.id)
        rows.append(
            {
                "projectId": project.fixture_id or project.id,
                "title": project.title,
                "teamName": project.team.name,
                "track": project.track.name if project.track else None,
                "trackId": project.track.fixture_id if project.track else None,
                "reviews": stats.reviews if stats else 0,
                "rawMean": round(stats.raw_mean, 3) if stats else None,
                "normalized": round(stats.normalized, 3) if stats else None,
                "disagreement": round(stats.disagreement, 3) if stats else None,
                "lowConfidence": stats.low_confidence if stats else True,
                "duplicateOf": (by_id[superseded[project.id]].fixture_id or superseded[project.id])
                if project.id in superseded
                else None,
            }
        )

    ranked = [r for r in rows if r["normalized"] is not None and not r["duplicateOf"]]
    sort_key = lambda r: (-r["normalized"], -r["rawMean"], -r["reviews"], r["title"])  # noqa: E731
    ranked.sort(key=sort_key)
    keys = {r["projectId"]: (round(r["normalized"], 2),) for r in ranked}
    overall = competition_ranks([r["projectId"] for r in ranked], keys)
    raw_order = sorted(ranked, key=lambda r: (-r["rawMean"], r["title"]))
    raw_ranks = competition_ranks(
        [r["projectId"] for r in raw_order], {r["projectId"]: (round(r["rawMean"], 2),) for r in raw_order}
    )
    by_track: dict[str, list[dict]] = defaultdict(list)
    for row in ranked:
        by_track[row["track"] or ""].append(row)
    track_ranks: dict[str, int] = {}
    for items in by_track.values():
        track_ranks.update(competition_ranks([r["projectId"] for r in items], keys))

    for row in rows:
        row["rank"] = overall.get(row["projectId"])
        row["rawRank"] = raw_ranks.get(row["projectId"])
        row["trackRank"] = track_ranks.get(row["projectId"])
    rows.sort(key=lambda r: (r["rank"] is None, r["rank"] or 0, r["title"]))

    calibration = sorted(
        (
            {
                "id": judges[c.judge_id].fixture_id or c.judge_id,
                "name": judges[c.judge_id].name or judges[c.judge_id].email,
                "reviews": c.reviews,
                "rawMean": round(c.raw_mean, 3),
                "rawSpread": round(c.raw_spread, 3),
                "leniency": round(c.leniency, 3),
                "spread": round(c.spread, 3),
                "flat": c.flat,
            }
            for c in result.judges.values()
            if c.judge_id in judges
        ),
        key=lambda j: -abs(j["leniency"]),
    )

    return {
        "method": METHOD,
        "rubric": [serialize_criterion(c) for c in rubric],
        "eventMean": round(result.event_mean, 3),
        "eventSpread": round(result.event_spread, 3),
        "projects": rows,
        "judges": calibration,
    }
