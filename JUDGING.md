# Judging

How judges join, get work, score, and how their scores become results. Everything below is enforced in the
backend; the UI only reflects it.

## Roles

| Role | Sees scores | Submits scores | Manages judging |
|------|-------------|----------------|-----------------|
| Judge | Own scores only, on projects assigned inside their tracks | Assigned projects, while scoring is open | No |
| Organizer / Admin | All scores, results and exports | No | Yes |
| Participant / Visitor | No | No | No |

## The judge panel

Judging is per event. A judge is only a judge **of an event** once they have a seat on its panel
(`event_judges`). A seat is either event-wide or scoped to one or more tracks (`event_judge_tracks`).

**Invitation.** An organizer creates a single-use invite link from the judging console
(`/organizer/events/{slug}/judging`, Judges tab). Each invite can:

- be locked to one email address, so only the account with that address can accept it;
- carry a track scope;
- expire after 1 to 90 days.

When a visitor accepts, they become a judge and take their seat. Accepting is refused for:

- participants;
- anyone registered for, or on a team in, the same event (a conflict of interest);
- organizer and admin accounts.

An existing judge account can also be seated directly by email.

Changing a seat's tracks withdraws any unscored assignments that fall outside the new scope. If the judge has already
scored projects in a track being removed, the change is refused, so no score silently disappears from view.

## Assignment

A judge can only be assigned a project that is:

- submitted,
- in the same event,
- inside the judge's tracks, and
- not from a team the judge belongs to.

The same rule (`services/judging.py`, `ineligible_reason`) guards both assignment modes:

- **By batch.** Select judges and projects; every pair is assigned under a batch label. Pairs that break a rule
  are skipped and reported with the reason, instead of failing the whole batch.
- **Automatically.** Set how many reviews each project should have (and optionally a per-judge cap). The planner:
  - fills the **scarcest** projects first (those with the fewest eligible judges), so a narrow track isn't starved;
  - gives each project to the least-loaded eligible judges, breaking ties with a stable hash;
  - counts existing assignments, so running it again only fills the gaps;
  - offers a dry run that previews the resulting load per judge and lists projects that can't reach the target.

Superseded duplicate submissions are not auto-assigned. The fixture data contains one: team `tm_07` submitted
*Dry Harbour* twice, and only the later copy, `prj_41`, counts.

Scored assignments can't be removed.

## Rubric

Each event has 1 to 10 criteria. Each criterion has a name, guidance text that judges see next to it, and a weight
between 0.1 and 10. Judges rate **every** criterion with a whole number from 1 to 5.

```
weighted_total = Σ(score_i × weight_i) / Σ(weight_i)
```

Weights are applied when totals are read, never stored in scores. Organizers can therefore re-weight at any time
and every total, result and export recalculates.

Once the first score exists, the *set* of criteria is locked: no criterion can be added, removed or renamed. This
keeps every score rating the same things.

## Scoring window

A judge can score only after `submissions_close` (and after `judging_starts`, if set) and before `judging_ends`
(if set). Until the deadline passes, a team can still change its project, so scoring before then would mean scoring
a moving target. Outside the window, score writes return `409` with the reason.

## Role isolation

All judge reads and writes go through `services/judging.py`:

- `/api/judge/assignments` and `/api/judge/scores` return only the caller's own rows, after checking panel seat,
  track scope and project status.
- `?judge=<someone else>` on `/api/judge/scores` returns `403`. No code path returns a peer's scores to a judge.
- `POST /api/judge/scores` returns the same `403` for "not assigned" and "unknown project", so the endpoint can't
  be used to probe which projects exist.
- `/api/projects/{id}` treats a judge as staff (private answers, member emails) only for projects assigned to them
  inside their tracks. For every other project a judge gets the public view, and drafts remain `404`.
- Assignments forced into the database outside a judge's tracks are still hidden and unscorable. This is tested
  in `tests/test_t2_judging.py::test_track_judge_cannot_score_or_read_other_track`.

## Progress

The Progress tab (and `GET /api/organizer/events/{slug}/judging/progress`) lists every panel judge with:

- a status: `unassigned`, `not_started`, `in_progress` or `done`;
- assigned and completed counts;
- the time of their last score.

The list is sorted least-progress first and refreshes every 15 seconds, so an organizer can see at a glance who
hasn't started.

## Normalization

Results rank projects by a cross-judge normalized score, not by raw averages. See [NORMALIZATION.md](NORMALIZATION.md)
for the method, the reasoning behind it, and a run on the fixture data.

## CSV export

`GET /api/export.csv?event={slug}&kind={kind}` returns one file per stage. It is available to organizers and admins
only.

| kind | Contents |
|------|----------|
| `registrations` | Everyone registered, with their team |
| `teams` | Members, size and project status per team |
| `submissions` | Every project (drafts included) with all fields and custom answers |
| `judges` | Panel: scope, progress, last activity |
| `assignments` | Judge × project, batch, assigned at, scored |
| `scores` (default) | One row per judge and project: criteria, comment, weighted total |
| `results` | Rank, track rank, raw rank, raw mean, normalized, disagreement, flags |

Cells that start with `=`, `+`, `-` or `@` are prefixed with `'`, so a project titled `=HYPERLINK(...)` can't run
as a formula when an organizer opens the file.

## API

| Method | Path | Role |
|--------|------|------|
| GET | `/api/judge/events` | Judge: panels, scope, rubric, scoring window |
| GET | `/api/judge/assignments?event=` | Judge |
| GET | `/api/judge/scores` | Judge (own only; `?judge=peer` returns 403) |
| POST | `/api/judge/scores` | Judge |
| GET | `/api/judge/rubric?event=` | Judge |
| GET / POST | `/api/judge-invites/{token}` / `…/accept` | Public preview / signed-in accept |
| GET | `/api/organizer/events/{slug}/judging` | Organizer overview |
| GET | `…/judging/progress` | Live progress |
| GET, POST | `…/judges`, `…/judges/invites` | Panel and invites |
| PATCH, DELETE | `…/judges/{judge}` | Change scope, remove from panel |
| DELETE | `…/judges/invites/{id}` | Revoke invite |
| GET, POST, DELETE | `…/assignments` | List with coverage, batch assign, unassign |
| POST | `…/assignments/auto` | Automatic assignment (`dryRun` supported) |
| GET, PUT | `…/rubric` | Read or replace the rubric |
| GET | `…/results` | Raw and normalized standings, judge calibration |
| GET | `/api/export.csv?event=&kind=` | CSV exports |

Every judging change (invites, seats, scope changes, assignments, rubric edits and scores) is written to the audit
log that admins read at `/admin`.

### Submit score body

```json
{
  "project_id": "prj_01",
  "criteria": { "functionality": 4, "quality": 5, "innovation": 3 },
  "comment": "Solid demo."
}
```

Judge aliases used by the acceptance checker: `judge_a` is `jdg_01` and `judge_b` is `jdg_02`.
