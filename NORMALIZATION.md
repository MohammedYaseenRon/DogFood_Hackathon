# Cross-judge normalization

**Method:** shrunken per-judge z-scores, mapped back onto the event's 1–5 scale.
**Code:** `backend/app/services/normalization.py` (pure functions, no database).
**Reproduce on the fixtures:** `cd backend && python -m app.normalization_report`.

## The problem

Every project is seen by a different handful of judges. Two effects that have nothing to do with the project then
leak into a raw average:

- **Leniency.** One judge's 3 is another judge's 4.
- **Spread.** One judge uses the whole scale; another never leaves 3–4.

With raw means, a project's rank partly measures *which judges it drew*. In the fixture data the most generous judge
averages 4.22 and the harshest averages 2.0. That gap is more than three times the event's whole standard deviation.

## The method

Let *x* be a review's weighted total (see [JUDGING.md](JUDGING.md)). For each judge *j* with *nⱼ* reviews, mean *mⱼ*
and standard deviation *sⱼ*, and with *M* and *S* the mean and standard deviation of all reviews in the event:

```
m̂ⱼ = (nⱼ·mⱼ + k·M) / (nⱼ + k)              shrunken mean
ŝⱼ = √((nⱼ·sⱼ² + k·S²) / (nⱼ + k))          shrunken spread
ŝⱼ = max(ŝⱼ, 0.25·S)                          spread floor
z  = (x − m̂ⱼ) / ŝⱼ
x' = clamp(M + S·z, 1, 5)
```

A project's normalized score is the mean of *x'* over its reviews, with **k = 3**.

In words: each judge's scores are re-centred on that judge's own habits, then put back on the event's scale. The
result is still a number an organizer can read as "about a 4".

## Why this and not something else

| Option | Why not |
|--------|---------|
| Raw mean | Rewards drawing generous judges. |
| Mean-centring only (subtract each judge's mean) | Fixes leniency, not spread. A judge who scores 1 and 5 would dominate a judge who scores 3 and 4 when both meant "worse and better". |
| Plain z-scores | Breaks on the fixture's awkward cases. A judge with one review has *s* = 0, so *z* = 0/0. A judge who gave every project the same score also has *s* = 0, so any rounding noise is amplified without bound. |
| Rank-based (Borda, per-judge percentiles) | Throws away how far apart projects are. With 1–6 reviews per judge, ranks are very coarse. |
| Bradley–Terry / pairwise | Needs pairwise comparisons, which this event doesn't collect. It fits a Pairwise judging mode, not 1–5 rubric scores. |
| Full mixed model (project + judge random effects) | Most principled, but harder to explain and to audit by hand. It needs an optimiser and is more likely to break on 2-review projects. Our shrinkage is the closed-form, one-pass cousin of the same idea. |

**Shrinkage** treats each judge as having *k* pseudo-reviews at the event average:

- A judge with **many** reviews is described by their own data. That is exactly when leniency can be measured
  reliably.
- A judge with **one** review is left almost alone. Their mean is pulled most of the way back to the event mean,
  so their opinion mostly survives. Plain z-scoring would erase it.
- *k* = 3 is about the median number of reviews per judge in the fixtures (4.2 on average). A judge therefore
  needs roughly as much evidence as the typical judge before their own habits dominate.

**The spread floor** handles the judge who didn't discriminate. Iva Petrova (`jdg_07`) gave three projects 4/4/4.
Her raw spread is 0. After the floor her spread is 0.46, her three reviews normalize to the same value, and she
moves those projects only by her small measured leniency. That is the honest reading: she said "these are equally
good, and slightly above average".

## Guarantees (tested)

`backend/tests/test_t2_judging.py` checks these properties:

- **A judge's own ordering is preserved.** Normalization is monotone within a judge, so if a judge scored A above
  B, A's normalized review is still above B's.
- **Leniency is removed.** Two judges with the same opinions, one a point more generous, end up closer after
  normalization than before.
- **Nothing becomes non-finite.** Flat judges and single-review judges produce finite scores inside 1–5.
- **Confidence is reported.** Projects with fewer than 3 reviews are flagged *low confidence* on the results page
  and in the export.

If every score in the event is identical (S = 0), there is nothing to calibrate against. Normalized scores then
equal raw scores.

## On the fixture data

This is the output of `python -m app.normalization_report`: 126 reviews, 41 projects and 30 judges.

```
event mean/sd    3.566 / 0.648
not ranked       prj_07 (superseded duplicate)
rank changed     32 of 40 projects; largest move 10 places
top-10 overlap   9 of 10
low confidence   8 projects with < 3 reviews

 rank  raw  reviews  raw    norm   project
    1    1        3  4.33   4.34   Iron Switch
    2    1        4  4.33   4.19   Salt Ledger
    3    6        3  4.00   4.11   Slow Trail
    4    5        4  4.08   4.08   Salt Loom
    5    4        3  4.11   4.03   Dry Relay
    6    3        2  4.17   4.01   Still Beacon  (low confidence)
    ...
```

How to read it:

- **The top is stable; the middle moves.** Nine of the raw top ten stay in the top ten. Most movement happens in
  the crowded middle, where a 0.1 raw difference is mostly noise from judge draw.
- **Iron Switch and Salt Ledger** tie on raw mean at 4.33. Salt Ledger's reviews came partly from Wei Lindqvist,
  the most lenient judge (+0.44), so normalization separates the tie in Iron Switch's favour.
- **Slow Trail** rises from 6th to 3rd. Its 4.0 came from a panel that scores slightly below average on balance
  (leniency −0.16, +0.10, −0.06), so its 4 is worth a little more than a 4 from Wei.
- **Still Beacon** falls from 3rd to 6th and is flagged low confidence: it has only two reviews, one of them from a
  lenient judge.

## Edge cases in the fixtures

| Case | Handling |
|------|----------|
| Judge who gave every project the same score (`jdg_07`: 4/4/4) | Spread floor. Reviews carry leniency information, not rank information. |
| Judges with a single review (`jdg_01`, `jdg_23`) | Shrunk strongly toward the event mean, so their opinion survives. |
| Unfinished batches: projects with 2 reviews next to projects with 5 | Every project is still scored. Fewer than 3 reviews is flagged low confidence, and the organizer can see and fill gaps in the Assignments tab. |
| Duplicate submission (`tm_07` submitted *Dry Harbour* as `prj_07` and `prj_41`) | The later copy is ranked. The earlier one is listed as a duplicate, not ranked, and not auto-assigned. Its scores still help calibrate the judges who gave them, because they are real opinions. |

## What an organizer sees

Results & exports tab in the judging console:

- the standings, with the raw rank next to the normalized rank (▲/▼);
- low-confidence and "judges split" flags (spread of normalized reviews ≥ 0.75);
- each judge's measured leniency;
- the `results` CSV, with raw and normalized columns side by side.

Nothing is hidden: organizers can always fall back to the raw numbers.
