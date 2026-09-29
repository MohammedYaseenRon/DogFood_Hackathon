# Hackboard

Open-source hackathon submission and judging platform, built for [DOGFOOD 2026](https://dogfoodhack.com).

## Structure

```
backend/     FastAPI + SQLAlchemy + SQLite API (port 4000)
frontend/    Next.js UI (port 8080, proxies API routes for acceptance checks)
dog_food/    Official spec, fixtures.json, and run.py checker
```

## Quick start (local dev)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --port 4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:8080

## Docker

```bash
docker compose up --build
```

Portal: http://localhost:8080

## Acceptance checker

With the stack running:

```bash
python dog_food/run.py .dogfood.toml > acceptance-report.txt
```

`run.py` only checks T1 and T2. Our own checker covers the rest in the same style (standard library only, uses the
`.dogfood.toml` headers, changes no event data): T3, the T4 import/export we built, and the Normalization Proof
bonus.

```bash
python scripts/acceptance_extra.py .dogfood.toml
```

## What's done, honestly

| Tier | Status | Proof |
|---|---|---|
| T1 core portal | Done | `acceptance-report.txt` (checker), `tests/test_t1_core.py` |
| T2 judging engine | Done | `acceptance-report.txt` (checker), `tests/test_t2_judging.py`, [JUDGING.md](JUDGING.md) |
| T3 community | Done, claimed | `scripts/acceptance_extra.py` (23/23 checks), `tests/test_t3_community.py` (25 tests), [VOTING.md](VOTING.md). `run.py` has no T3 checks, so its report prints "claimed but not verified: T3". |
| T4 stretch | One of five items: bulk import/export. Not claimed. | `scripts/acceptance_extra.py` (5/5 checks), `tests/test_portability.py`. Not built: API keys and webhooks, certificates, signed judge records, embed widget. |
| Bonus: Normalization Proof | Done | `scripts/acceptance_extra.py` (5/5 checks), [NORMALIZATION.md](NORMALIZATION.md), `cd backend && python -m app.normalization_report` |

`.dogfood.toml` claims **T1, T2 and T3**. The acceptance checker verifies T1 and T2; it has no T3 checks, so T3 is backed by our own tests instead. T4 is not claimed.

Documents:
- [ARCHITECTURE.md](ARCHITECTURE.md): system design, decisions and limitations
- [DATA-MODEL.md](DATA-MODEL.md): schema, and every import and export path
- [JUDGING.md](JUDGING.md): panel, invites, assignment, rubric, isolation, progress and exports
- [NORMALIZATION.md](NORMALIZATION.md): cross-judge normalization, defended and run on the fixtures
- [VOTING.md](VOTING.md): community voting, quadratic voting, hidden results, shuffled ballots, rate limits,
  duplicate detection and the audit trail

## Moving in and out

A whole event moves as one JSON file in the `fixtures.json` shape, so the official fixtures import as-is:

- **Import:** organizer dashboard, **Import event**. It shows a dry-run preview with every problem before saving.
  Or run `python -m app.transfer import event.json --dry-run`.
- **Export:** organizer event page, **Export event (JSON)**. Or run
  `python -m app.transfer export sample-hack-2026 event.json`.
- **CSV:** 11 kinds of CSV, from registrations to the audit trail.

Round trips are lossless and tested. Details: [DATA-MODEL.md](DATA-MODEL.md#import-and-export-paths).

## Known limitations

- **Roles are platform-wide.** Any organizer can manage any event. Judges are scoped per event and per track.
- **No outgoing email.** The email-gated voting code is shown on screen and in the server log
  (`EMAIL_DEV_PREVIEW=1`).
- **SQLite allows one writer at a time.** That is fine at hackathon scale. Set `DATABASE_URL` for Postgres.
- **The API needs a session cookie.** There are no API keys or webhooks yet.

## Dev startup (Windows)

```powershell
.\scripts\start-dev.ps1
```

Or run backend and frontend in separate terminals (see Quick start above).

## Environment variables

Copy examples and adjust as needed:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | backend | SQLite or PostgreSQL connection string |
| `FIXTURES_PATH` | backend | Path to `dog_food/fixtures.json` for seeding |
| `APP_BASE_URL` | backend | Public frontend URL used in team invite links |
| `BACKEND_URL` | frontend | FastAPI base URL for server-side fetches and rewrites |
| `SEED_PASSWORD` | backend | Password given to seeded demo accounts (default `hackboard-demo`) |
| `DEMO_LOGINS` | backend | `1` (default) enables one-click demo role sessions; set `0` in production |

## Database setup

```bash
cd backend
python -m app.seed      # create tables + load fixtures
```

Re-run seed any time you need demo users, teams, and sample submissions restored.

The seed creates two events:

| Event | Slug | State |
|-------|------|-------|
| Sample Hack 2026 (fixture data) | `sample-hack-2026` | Deadline from `fixtures.json` (past) — judging/completed. Used by the acceptance checker. |
| Hackboard Open Hack | `hackboard-open-hack` | Open for 30 days from first seed — try the full register → team → submit flow here. Dates are only set on first seed, so organizer edits survive re-seeding. |

## Authentication

Email/password auth with server-side sessions (scrypt hashes, 14-day HttpOnly `session` cookie):

- `POST /api/auth/register` — creates a **visitor** account and signs in
- `POST /api/auth/login` / `POST /api/auth/logout` — logout deletes the session row, not just the cookie
- `GET /api/auth/me`, `PATCH /api/auth/me` — current user / update display name
- `POST /api/auth/password` — change password (signs out other sessions)

Roles: `VISITOR → PARTICIPANT` happens automatically when a user registers for an event, creates a team,
or accepts a team invite. `JUDGE`, `ORGANIZER` and `ADMIN` are assigned by an admin at `/admin`.

Seeded demo accounts can sign in by email with `SEED_PASSWORD` (default `hackboard-demo`):
`admin@hackboard.local`, `organizer@hackboard.local`, `tomas.varga@example.org` (judge A),
`wei.lindqvist@example.org` (judge B), `priya1@example.org` (participant). The one-click demo roles on
`/login` use the fixed acceptance-test sessions and are disabled with `DEMO_LOGINS=0`.

Frontend pages: `/register`, `/login`, `/account`.

## Running tests

```bash
cd backend
pytest
```

## Key routes

| Route | Description |
|-------|-------------|
| `/events` | Published hackathon listing |
| `/events/:slug` | Event detail, full timeline, registration and next-step guidance |
| `/projects` | Public gallery: search, event / track / tech-tag filters, sorting |
| `/projects/:id` | Project page (video embed, screenshots). Drafts are visible only to the team and staff |
| `/projects/new?event=:slug` | Create / edit your team's submission (draft → submit → edit until the deadline) |
| `/teams/new?event=:slug` | Create a team |
| `/teams/:id` | Team members, roles, leave/remove, invite links |
| `/join/:token` | Team invite acceptance |
| `/participant` | Participant hub: every event you're in, with team and project status |
| `/account` | Profile and password |
| `/organizer/dashboard` | All events + judging progress per event |
| `/organizer/import` | Import a whole event from JSON (fixtures.json shape), with a dry-run preview |
| `/organizer/event/new` | Create an event (dates, tracks, prizes, custom submission questions) |
| `/organizer/events/:slug` | Event overview: teams, drafts and submissions |
| `/organizer/events/:slug/edit` | Edit an event |
| `/organizer/events/:slug/judging` | Judging console: live progress, judge panel and invites, batch / automatic assignment, rubric, normalized results, CSV exports |
| `/judge-invite/:token` | Judge invite acceptance |
| `/vote/:slug` | Community ballot (shuffled per voter; results only after close + publish) |
| `/organizer/events/:slug/voting` | Voting settings, share link, live tally, ballot review |
| `/organizer/events/:slug/audit` | The event's audit trail in plain language, with search and CSV |
| `/judging` | Judge scoring workspace (only assigned projects inside the judge's tracks) |
| `/admin` | Users (roles, suspend), platform stats, audit log |

## Submission and deadline rules (T1)

All calendar checks live in `backend/app/services/event_state.py`, so the API and the UI agree:

- **Registration** is open inside the registration window and never after the submission deadline.
- **Team formation** (create, join by invite, new invites, member changes) is open from registration until the deadline.
- **Submissions** (create, edit, submit, un-submit) are open from the event start until the deadline. Every write
  after the deadline returns `403`; nothing is enforced only in the browser.
- A team has one project per event. A **draft** needs only a name and track and is hidden from the public.
  **Submitting** additionally requires a description, a repository URL and every required organizer question.
- Organizer question answers are visible to the team, organizers and the judges assigned to that project, never on the public page.
- All URLs must be `http(s)://`; up to 8 screenshots and 15 tech tags.
- The thumbnail and screenshots can be **uploaded** (PNG, JPEG, WebP or GIF, 5 MB max, type checked from the file's
  bytes) or linked. Uploads are stored in `backend/data/uploads` (override with `UPLOAD_DIR`).
