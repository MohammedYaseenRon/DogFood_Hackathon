# Judging

How scores are collected, weighted, and isolated in the Dogfood portal.

## Roles

| Role | Can view scores | Can submit scores |
|------|-----------------|-------------------|
| Judge | Own scores only | Assigned projects only |
| Organizer | CSV export (all scores) | No |
| Participant | No | No |

## Rubric

Each event defines weighted criteria (seeded from fixture score keys):

- `functionality`
- `quality`
- `innovation`

Default weight is `1.0` for each criterion. Organizers can adjust weights via `PATCH /api/organizer/rubric`.

### Weighted total

For a judge's criteria scores `s_i` with weights `w_i`:

```
weighted_total = Σ(s_i × w_i) / Σ(w_i)
```

Each criterion must be an integer from 1 to 5.

## API

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/judge/rubric` | Judge | List criteria and weights |
| GET | `/api/judge/assignments` | Judge | Assigned projects with score status |
| GET | `/api/judge/scores` | Judge | Own submitted scores |
| GET | `/api/judge/scores?judge=judge_a` | Judge | Own scores only (403 for peers) |
| POST | `/api/judge/scores` | Judge | Submit or update a score |
| GET | `/api/organizer/rubric` | Organizer | View rubric weights |
| PATCH | `/api/organizer/rubric` | Organizer | Update rubric weights |
| GET | `/api/export.csv` | Organizer | Export all scores |

### Submit score body

```json
{
  "project_id": "prj_01",
  "criteria": {
    "functionality": 4,
    "quality": 5,
    "innovation": 3
  },
  "comment": "Solid demo."
}
```

## Peer isolation

Judges cannot read another judge's scores. The acceptance checker verifies that Judge B receives `403` when requesting `?judge=judge_a`.

Judge aliases map to fixture users:

- `judge_a` → `jdg_01`
- `judge_b` → `jdg_02`

## UI

Judges use `/judging` to:

1. View assigned projects and progress
2. Open a score form with 1–5 score boxes per criterion
3. See a live weighted total preview
4. Submit or update scores
