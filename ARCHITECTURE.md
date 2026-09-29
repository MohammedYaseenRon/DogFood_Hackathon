# Architecture

Dogfood Portal is a hackathon platform: events, teams, submissions and a public gallery, backend-enforced judging,
and community voting. Organizers, judges, participants and the public all use the same product.

```
 browser ──► Next.js 16 (port 8080) ──rewrite /api/*──► FastAPI (port 4000) ──► SQLite (one file)
             React 19 server + client                  SQLAlchemy 2            data/dev.db
             components                                services/ = rules       data/uploads/
```

`docker compose up` starts both processes. The backend seeds the database from `dog_food/fixtures.json` on boot.
Nothing talks to the internet: no cloud account, hosted database, auth provider or email service.

## Why two processes

- **The backend owns every rule.** Roles, deadlines, judge scope, voting windows and rate limits are all decided in
  Python. The frontend only decides what to *show*. The acceptance checker and `curl` hit the same API the UI uses,
  so a rule painted only in React would fail those checks.
- **The frontend is a thin, typed client.** All API calls and response types live in one file,
  `frontend/src/lib/api.ts`. Server components fetch through `lib/server-api.ts` and forward the session cookie.
- **One origin.** Next rewrites `/api/*` to FastAPI, so the browser sees a single origin. That keeps the session
  cookie simple (`HttpOnly`, `SameSite=Lax`) and avoids CORS. The login, register, logout and session routes are
  Next route handlers that proxy to FastAPI and set the cookie. They also forward the client IP for rate limiting.

## Backend layout (`backend/app`)

| Layer | Contents | Rule |
|---|---|---|
| `routes/` | HTTP only: parse, authorise, call a service, serialise | No business rule is written twice |
| `services/` | The rules, as plain functions over a DB session | Unit-testable without HTTP |
| `models.py` | SQLAlchemy schema, see [DATA-MODEL.md](DATA-MODEL.md) | |
| `migrate.py` | Additive `ALTER TABLE` upgrades for existing SQLite files | Idempotent, runs on every boot |
| `seed.py` | Fixtures to database, demo accounts, demo voting data | Re-runnable; upserts by fixture id |
| `transfer.py` | CLI for whole-event export and import | Same code as the HTTP endpoints |

These services hold the decisions a reviewer is most likely to ask about:

- `event_state.py`: the event calendar and what it allows (register, form teams, submit, score, vote). Both the
  API and the UI read phases from here.
- `judging.py`:
  - Who may see or score which project: the panel seat, track scope, assignment, and whether the judge is on
    the team.
  - Automatic assignment: greedy, fewest-eligible-judges first.
  - Duplicate submission detection.
  - Progress and results.
- `normalization.py`: pure functions for cross-judge normalization, with no database access. Explained and run on
  the fixtures in [NORMALIZATION.md](NORMALIZATION.md).
- `voting.py`: voter identity (account, verified email, or open-link cookie), per-voter shuffled ballots, the
  quadratic tally and the abuse flags. See [VOTING.md](VOTING.md).
- `ratelimit.py`: a sliding-window limiter stored in the database, so no Redis is needed.
- `portable.py`: exports and imports a whole event as JSON (`dogfood-event/1`).
- `audit.py`: append-only audit log. The event audit page turns it into plain language.

## Auth and isolation

- **Sessions.**
  - The `session` cookie holds a 32-byte random key.
  - The `sessions` table maps the key to a user and an expiry.
  - Logout deletes the row, and changing the password deletes the user's other sessions.
  - Passwords are hashed with scrypt.
- **Roles.** `VISITOR < PARTICIPANT < JUDGE < ORGANIZER < ADMIN`, checked with `require_role` in each route.
- **Isolation is per request, in SQL.** Judges only ever get rows filtered to their own seat, assignments and
  tracks. For example, `GET /api/judge/scores?judge=<someone else>` returns `403` rather than filtering in the
  browser. The acceptance checker verifies this, and `tests/test_t2_judging.py` covers the rest: track judges,
  a judge on the project's own team, and drafts.
- **Draft projects** are visible only to their team and to staff. Staff means organizers, admins, and judges
  assigned to that project.

## Key decisions

| Decision | Why | Cost |
|---|---|---|
| SQLite, single file | Runs on a laptop with zero setup, and a backup is one file copy. SQLAlchemy keeps Postgres one `DATABASE_URL` away. | One writer at a time. That is fine at hackathon scale (hundreds of users), but not for thousands voting in the same second. |
| Additive migrations in `migrate.py`, not Alembic | Every schema change so far only adds columns, so upgrading an old `dev.db` needs no tooling. | Renames or drops would need Alembic. We'd add it before the first destructive change. |
| Portable ids (`fixture_id`) next to database ids | Imports are idempotent, and exports keep the fixture ids, so a round trip is lossless. | Two ids per row to keep straight. The API uses database ids; files use portable ids. |
| Scores stored raw; normalization computed on read | Changing the rubric weights or the method re-ranks without rewriting data, and raw scores stay auditable. | Results are recomputed per request. That takes milliseconds for 40 projects and 130 reviews. |
| Rate limits and audit log in the database | No extra infrastructure to run. | Both tables grow. Rate events older than their window can be pruned. |
| Quadratic voting by default | Rewards broad support over a loud minority. Defended in VOTING.md. | Weak to fake identities, which is why the identity modes and abuse flags exist. |

## Testing

- **Backend unit and HTTP tests:** `backend/tests`, run with `pytest`. Each test gets a fresh in-memory database.
- **Acceptance checker:** `dog_food/run.py` against the running portal. The output is committed as
  `acceptance-report.txt`.
- **Frontend:** checked with `tsc` and `eslint`, and by the production build that the Docker image runs.

## Honest limitations

- **Roles are platform-wide.** Any organizer can manage any event; there are no per-event organizer seats yet.
  Judges, on the other hand, are seated per event and per track.
- **No outgoing email.** Email-gated voting shows the code on screen and in the server log
  (`EMAIL_DEV_PREVIEW=1`). Production would plug a mail provider into `services/voting.py`.
- **Not built (T4):** API keys and webhooks, certificates, signed judge records, an embeddable widget. The REST API
  works for scripts with a session cookie, but there are no scoped tokens.
- **The acceptance checker only covers T1 and T2.** T3 and the import/export path are verified by our own tests
  (`test_t3_community.py`, `test_portability.py`), and `.dogfood.toml` claims T1, T2 and T3 with a comment saying so.
