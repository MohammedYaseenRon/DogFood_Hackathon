# Dogfood Portal

Open-source hackathon submission and judging platform for [DOGFOOD 2026](https://dogfoodhack.com).

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

## Target tiers

T1 + T2 verified. See `acceptance-report.txt` and `.dogfood.toml` for routes and test session cookies.

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

## Database setup

```bash
cd backend
python -m app.seed      # create tables + load fixtures
```

Re-run seed any time you need demo users, teams, and sample submissions restored.

## Authentication

Production-style email/password auth is available:

- `POST /api/auth/register` — creates a visitor account and session
- `POST /api/auth/login` — email/password login
- `POST /api/auth/logout` — clears session
- `GET /api/auth/me` — current user

Demo role sessions (for acceptance tests) remain available via `POST /api/auth/session?key=...`.

Frontend pages: `/register`, `/login`.

## Running tests

```bash
cd backend
pytest
```

## Key routes

| Route | Description |
|-------|-------------|
| `/events` | Published hackathon listing |
| `/events/:slug` | Event detail + registration |
| `/projects` | Public submitted project gallery |
| `/projects/:id` | Project detail page |
| `/join/:token` | Team invite acceptance |
| `/participant` | Participant dashboard |
| `/organizer/dashboard` | Organizer operations |
| `/judging` | Judge scoring workspace |
| `/admin` | Platform admin (users, stats) |
