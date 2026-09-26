# Dogfood Portal — Frontend Design Spec

## Design system

| Token | Value | Usage |
|-------|-------|--------|
| Primary | `#4f46e5` (indigo-600) | CTAs, links, active nav |
| Surface | `#ffffff` | Cards, nav |
| Background | `#f8fafc` (slate-50) | Page bg |
| Text | `#0f172a` / `#64748b` | Headings / body |
| Success | `#059669` | Completed, open states |
| Warning | `#d97706` | Deadlines, closed |
| Danger | `#dc2626` | Errors, forbidden |
| Radius | `0.75rem` | Cards, inputs |
| Font | Inter | All UI |

## Shared components

- `PageHeader` — title, description, optional action slot
- `Card` — white panel with border
- `Button` — primary / secondary / ghost variants
- `Badge` — role and track labels
- `Stat` — metric tile for dashboards
- `EmptyState` — icon area + message + CTA
- `Alert` — info / warning / error banners

## Pages

### 1. Home `/`
- Hero: event name, tagline, primary CTA → gallery, secondary → event
- Stats row: project count, track count, submission status (closed)
- Three feature cards: Submit · Judge · Export

### 2. Gallery `/projects`
- Search + track filter bar
- Responsive grid of project cards (title, summary, track badge, team, repo link)
- Empty state when no matches

### 3. Submit `/projects/new`
- Closed-event banner (fixture date in past)
- Form: title, summary, repo URL, track select (disabled when closed)
- Requires participant login hint

### 4. Event `/event`
- Event header with close date badge
- Tracks grid
- Weighted rubric table

### 5. Login `/login`
- Role picker cards (organizer, judge A/B, participant)
- Logout + current session status

### 6. Team join `/teams/join/[token]`
- Team name hero
- Member list
- Join button (POST with session cookie)

### 7. Judging `/judging`
- Judge-only: assignment list with scored / pending badges
- Expandable score criteria per project
- Login prompt if unauthorized

### 8. Organizer `/organizer/dashboard`
- Stats: projects, judges, scores submitted, completion %
- Export CSV button
- Judge progress table

### 9. Nav (global)
- Logo, links, role badge when logged in
