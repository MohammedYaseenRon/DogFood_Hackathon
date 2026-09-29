# Community voting, comments and anti-abuse (T3)

Organizers run community voting from `/organizer/events/{slug}/voting`. Voters use `/vote/{slug}`. Everything below
is enforced by the backend, in `backend/app/services/voting.py` and `backend/app/routes/voting.py`.

## Who can vote

Each event picks one access mode. The organizer can switch between them at any time.

| Mode | Credential | One ballot per | Trade-off |
|------|-----------|----------------|-----------|
| **Signed-in accounts** (`authenticated`) | A portal account | Account | Strongest identity, most friction |
| **Email-gated** (`email`) | A 6-digit code sent to the address, valid 15 minutes, 5 attempts | Canonical email address | No account needed; an inbox is the cost of a vote |
| **Open link** (`open`) | The secret key in the voting URL | Browser, via an HttpOnly cookie | Easiest to reach, weakest identity; the abuse signals below matter most here |

**Email canonicalization.** Addresses are compared after lower-casing and removing `+tags`. For Gmail, dots are
also removed and `googlemail.com` is treated as `gmail.com`. So `Jane.Doe+vote@gmail.com` and `janedoe@googlemail.com`
are one voter, not two.

**No email provider?** With `EMAIL_DEV_PREVIEW=1` (the default for local runs), the code is shown on screen and
written to the server log. Set it to `0` once an email provider is wired in.

**Open-link key.** The key is compared in constant time. The organizer can replace it at any moment; the old link
stops working, but ballots already cast keep counting.

**Own team.** Nobody can vote for their own team's project. Their ballot shows it as "Your team", and the API
returns `403`. In email mode this also applies when the verified email belongs to a team member.

## Quadratic voting

In the default mode, each voter gets a budget of **credits** (25 by default). Putting *n* credits on one project
gives it **√n votes**. A project's score is the sum over voters of √(credits they gave it).

| Credits on one project | Votes it gets | Credits per vote |
|---|---|---|
| 1 | 1.0 | 1 |
| 4 | 2.0 | 2 |
| 9 | 3.0 | 3 |
| 25 | 5.0 | 5 |

**Why this and not one-person-one-vote**

- **A loud minority can't simply buy the outcome.** Ten people who each put all 25 credits on one project give it
  10 × 5 = 50. Fifty people who each put in 4 credits give their project 50 × 2 = 100. Broad support beats
  concentrated support, but intensity still counts. One-person-one-vote can't express "I really care about this
  one" at all.
- **It uses information a single vote throws away.** A voter can back three projects a little and one project a
  lot. The tally shows both how many people supported a project and how strongly.
- **Every extra vote costs more than the last.** Going from 3 to 4 votes on a project costs 7 more credits, while
  going from 0 to 1 vote on another project costs 1. That rising price is what spreads support across projects.

**Where it's weak (said up front).** Quadratic voting assumes one budget per real person. If one person controls
many identities, splitting credits across fake voters beats the √ curve: one person with 4 identities putting 25
credits each on a project gets 4 × 5 = 20 votes instead of 5. That is why the identity modes and the abuse signals
below are part of the design, not an afterthought. For high-stakes prizes, use signed-in or email-gated voting.

**Simple mode** is available as `simple`: each voter picks up to *N* projects, one vote each. The organizer's tally
always shows a **headcount rank** (supporters only) next to the quadratic rank, so the effect of the weighting is
visible.

**Locked rules.** The mode and the budget are locked once the first vote is cast, so every ballot follows the same
rules. The access mode, the time window and publication can still change.

## Results are hidden during voting

- The ballot endpoint returns projects and the voter's own choices, never a tally.
- `GET /api/vote/{slug}/results` returns `403` while voting is scheduled or open. After voting closes it still
  returns `403` until an organizer publishes the results, and publishing is refused while voting is open.
- Only organizers and admins can read the live tally (`/api/organizer/events/{slug}/voting/results`) and the
  `votes` CSV.
- Vote counts appear nowhere else: not on project pages, not in comments, and not in the gallery.

## Random order on every ballot

Each voter is given a random seed when their ballot is created, and sees the projects shuffled with it:

- **Different for each voter,** so no project is always first.
- **Stable for that voter,** so the list doesn't jump around when they reload.

The position each project had on the voter's screen is stored with each vote (`shown_position`). The organizer's
tally shows each project's **average slot**. If the order were biased, a project would sit near slot 1 for most
voters; with shuffling, every project's average sits near the middle of the ballot.

## Anti-abuse

### Rate limits

Stored in the database (`rate_events`), no extra infrastructure. Over-limit requests get `429` with a
`Retry-After` header.

| What | Limit |
|------|-------|
| New open-link ballots per network | 5 / hour |
| Email codes per network | 10 / hour |
| Email codes per address | 3 / 15 min |
| Code guesses per code | 5, then the code dies |
| Ballot saves per voter | 30 / 10 min |
| Comments per account | 5 / min and 50 / day |
| Account sign-ups per network | 10 / hour |
| Failed sign-ins per network and email | 10 / 15 min (successful sign-ins never count) |

The client IP is read from `X-Forwarded-For` only when the request comes from a trusted proxy (the Next.js server).
Otherwise anyone could spoof the header to reset their limits.

### Duplicate and coordination signals

These are flags for an organizer, not automatic verdicts: a campus network or conference Wi-Fi legitimately puts
many real people on one IP.

- **Same device.** Three or more ballots share a device fingerprint. The fingerprint is a salted hash of IP and
  user agent, scoped to one event and never reversible.
- **Burst.** Three or more new ballots from one device within 10 minutes.
- **Identical ballot.** Three or more ballots with exactly the same allocation across at least two projects, which
  is the fingerprint of copy-pasted instructions.
- **Fresh account.** The account was created less than an hour before it voted.
- **Aliases.** Collapsed at the source by email canonicalization, as described above.

The organizer reviews flagged ballots in **Ballot review**. Voiding a ballot requires a written reason. It removes
the ballot from the tally but keeps it on record, can be undone, and is logged.

### Comments

- Signed-in accounts only, on submitted and published projects.
- At most 2 links per comment and 2,000 characters.
- The same text can't be posted twice by one person within 24 hours, on any project.
- The rate limits above apply.
- Authors can delete their own comments.
- Organizers can hide a comment with a reason. Hidden comments disappear for everyone else but stay visible,
  marked, to organizers.

## Audit trail

`/organizer/events/{slug}/audit` lists everything that happened in the event, newest first, in plain language. For
example: *"Ballot voided · Event Organizer · Anonymous 3fa2c1: ballot stuffing"*.

- **Categories:** setup, submissions, teams, judging, voting and comments.
- **Search** across people, actions and details.
- **CSV export** with `kind=audit`.

Every write described in this document adds an entry: ballots saved, email verifications, voids and restores,
setting changes, link replacements, and comment posts, deletions and hides.

## Exports

On top of the T2 exports, `GET /api/export.csv?event={slug}&kind=` adds four kinds:

| kind | Contents |
|------|----------|
| `votes` | Rank, headcount rank, score, supporters, credits, average ballot position |
| `ballots` | Each ballot: voter, kind, projects, credits spent, device, flags, void status and reason |
| `comments` | Every comment, including hidden and deleted ones, with status |
| `audit` | The event's audit trail |

## Tests

- `backend/tests/test_t3_community.py` (25 tests) covers:
  - all three access modes, the email code flow and its attempt cap, and alias collapsing;
  - the quadratic budget and √ influence, and simple mode;
  - the own-team block, editable ballots and the voting window;
  - per-voter random but stable ordering;
  - hidden results, publishing only after close, and the mode/budget lock;
  - network rate limits, same-device and identical-ballot flags, voiding;
  - comment duplicate, link and rate rules, moderation and deletion;
  - the audit trail and the four new exports.
- `backend/tests/test_uploads.py` covers image uploads.
