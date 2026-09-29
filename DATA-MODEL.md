# Data model

The schema lives in `backend/app/models.py` (SQLAlchemy 2), stored in SQLite by default. Every table has a
UUID-hex string primary key. Timestamps are naive UTC. The API adds a `Z` when it returns them.

## Entities

```
users ─┬─< sessions
       ├─< event_registrations >── events ─┬─< tracks
       ├─< team_members >── teams ─────────┤   (teams.event_id)
       │                     └─< projects >┘   (projects.track_id)
       │                          ├─< project_custom_answers >── custom_questions ──(event)
       │                          └─< comments
       ├─< event_judges ──< event_judge_tracks >── tracks     (judge panel seat + track scope)
       ├─< judge_assignments >── projects                    (who reviews what, in which batch)
       └─< scores >── projects                               (one row per judge × project)

events ──< rubric_criteria        events ──< prizes          events ──< judge_invites
events ──1 voting_configs         events ──< voters ──< vote_allocations >── projects
events ──< email_codes            rate_events (key, time)    audit_logs (actor, action, event_id)
```

## Core tables

| Table | Purpose | Constraints worth knowing |
|---|---|---|
| `users` | People. `role` is `VISITOR`, `PARTICIPANT`, `JUDGE`, `ORGANIZER` or `ADMIN`. | `email` unique; `fixture_id` unique if set |
| `sessions` | Login sessions: the cookie key maps to a user and an expiry | Deleted on logout |
| `events` | One hackathon: calendar, team size, published flag | `slug` and `fixture_id` unique |
| `event_registrations` | Who signed up for an event | unique `(event_id, user_id)` |
| `tracks` | Categories inside an event | |
| `teams`, `team_members`, `team_invites` | Teams and their membership; invite links can be used a limited number of times and expire | unique `(team_id, user_id)` |
| `projects` | Submissions. `status` is `DRAFT` or `SUBMITTED`. Images and tags are stored as JSON lists. | one team, one track |
| `custom_questions`, `project_custom_answers` | Organizer-defined submission questions | unique `(project_id, question_id)` |
| `prizes` | Event or track prizes | |

## Judging tables

| Table | Purpose | Constraints worth knowing |
|---|---|---|
| `rubric_criteria` | Weighted criteria, each scored as a whole number from 1 to 5 | unique `(event_id, name)` |
| `event_judges` | A judge's seat on one event's panel | unique `(event_id, user_id)` |
| `event_judge_tracks` | The seat's track scope. No rows means the whole event. | unique `(event_judge_id, track_id)` |
| `judge_invites` | Single-use links to join a panel, optionally tied to one email address | `token` unique |
| `judge_assignments` | Which judge reviews which project, with `batch`, `assigned_by` and `assigned_at` | unique `(judge_id, project_id)` |
| `scores` | Raw criterion scores as JSON (`{"quality": 4, ...}`) plus a comment | unique `(judge_id, project_id)` |

**Why scores are stored as JSON rather than one row per criterion:** a review is written and read as a unit, and
the fixtures arrive in that shape. Criteria can also be renamed or added while old reviews keep their original
keys. The rubric table decides which keys count and with what weight. Normalized scores are **never stored**: they
are computed from raw scores on read, so changing a weight or the method cannot corrupt data.

## Community voting tables

| Table | Purpose | Constraints worth knowing |
|---|---|---|
| `voting_configs` | One per event: access mode, voting mode, credits, window, link token, published flag | unique `event_id` |
| `voters` | One ballot holder per event: an account, a canonical email or an anonymous cookie. Holds the salted device fingerprint, the ballot shuffle seed and void status. | unique `(event_id, user_id)` and `(event_id, email)` |
| `vote_allocations` | Credits a voter gave a project, plus the position the project had on that voter's screen | unique `(voter_id, project_id)` |
| `email_codes` | Hashed one-time codes, expiry and attempt count | |
| `comments` | Gallery comments, soft-deleted or hidden with a reason | |
| `rate_events` | Sliding-window rate limiter: one row per counted action | indexed `(key)` and `(created_at)` |
| `audit_logs` | Append-only trail: actor, action, resource, JSON metadata, `event_id` | indexed `action` and `event_id` |

No raw IP addresses, cookie values or email codes are stored, only salted or plain hashes of them.

## Two kinds of id

Every row that can arrive from outside (events, tracks, teams, projects and judge users) has both:

- `id`: the internal database key, used in the API and in URLs.
- `fixture_id`: the portable id from the source file (`evt_01`, `prj_07`). Rows created in the UI get a random one.

Imports match rows on `fixture_id`, so re-importing a file updates it instead of duplicating it. Exports write
`fixture_id`s, so an exported file imports into another portal unchanged.

## Migrations

`backend/app/migrate.py` runs on every boot, from `init_db`. It adds any missing columns to an existing SQLite
file, so pulling a new version never requires deleting `dev.db`. New tables are created by
`Base.metadata.create_all`. All changes so far are additive; see ARCHITECTURE.md for when we'd switch to Alembic.

## Import and export paths

### In

| Path | How |
|---|---|
| Official fixtures, on boot | `python -m app.seed` (Docker does this automatically). It loads `FIXTURES_PATH` and adds demo accounts. |
| Any event file, UI | Organizer dashboard, **Import event** (`/organizer/import`). A dry run shows counts and every problem first. |
| Any event file, HTTP | `POST /api/organizer/import` with the JSON as the body. Add `?dry_run=true` to check without saving. |
| Any event file, CLI | `python -m app.transfer import event.json [--dry-run]` |

The import format is **`fixtures.json`, extended**. A file with only the fixture keys (`event`, `tracks`,
`judges`, `teams`, `projects`, `scores`) is valid, so the official fixture file imports as-is. Optional extra
keys:
- `rubric`, with weights and descriptions
- `assignments`, with batches
- project fields: `status`, `tagline`, `demo_url`, `video_url`, `tech_tags` and the image URLs
- event calendar fields

Validation reports **every** problem with its location (for example `projects[3] (prj_04): unknown track
'trk_99'`) and writes nothing if there are any. A file that reuses another event's ids is refused, never merged.
People are matched by email and never lose a role they already have.

### Out

| Path | What you get |
|---|---|
| Organizer event page, **Export event (JSON)**, or `GET /api/organizer/events/{slug}/export.json` | The whole event in the import format above |
| `python -m app.transfer export <slug> event.json` | The same, from the CLI |
| `GET /api/export.csv?event={slug}&kind=` | 11 CSVs: registrations, teams, submissions, judges, assignments, scores, results (raw and normalized), votes, ballots, comments, audit |
| The SQLite file | `data/dev.db` in dev, or the `backend_data` Docker volume. The whole database is one file. |

**Round trip, tested:** exporting an event, importing it into an empty portal and exporting again gives a
byte-identical file, apart from `exported_at` (`backend/tests/test_portability.py`). Community ballots, comments
and the audit trail are deliberately left out of the JSON because they contain voters' personal data; they are
exported as CSV.
