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
