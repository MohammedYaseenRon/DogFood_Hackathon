"""Cross-judge score normalization.

Judges differ in two ways that have nothing to do with the projects in front of
them: *leniency* (one judge's 3 is another's 4) and *spread* (one judge uses the
whole 1-5 scale, another never leaves 3-4). Averaging raw scores lets whichever
judges a project happened to draw decide its rank.

Method: shrunken per-judge z-scores, mapped back onto the event's scale.

For every judge j with n_j reviews, mean m_j and standard deviation s_j of their
weighted totals, and the event-wide mean M and standard deviation S:

    m̂_j = (n_j * m_j + k * M) / (n_j + k)                 shrunken mean
    ŝ_j = sqrt((n_j * s_j² + k * S²) / (n_j + k))          shrunken spread
    ŝ_j = max(ŝ_j, FLOOR * S)                              spread floor
    z   = (x - m̂_j) / ŝ_j
    x'  = clamp(M + S * z, 1, 5)

A project's normalized score is the mean of x' over its reviews.

Why shrinkage (k = PRIOR_STRENGTH pseudo-reviews at the event average): a judge
with one review has m_j = x and s_j = 0, so plain z-scoring would erase their
opinion entirely (z = 0/0). Shrinkage lets their few scores move their estimate
only a little, so a sparse judge is treated almost like an average judge and
their raw opinion mostly survives. A judge with many reviews is dominated by
their own data, which is exactly the case where leniency can be measured.

Why the spread floor: a judge who gave every project the same score has s_j = 0.
Without a floor their tiny ŝ_j would blow small differences up; with it, their
reviews all land near the event mean and carry little rank information, which is
the honest reading of a judge who didn't discriminate.

The full argument, alternatives considered and a worked run on the fixture data
live in NORMALIZATION.md.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field

SCALE_MIN = 1.0
SCALE_MAX = 5.0
PRIOR_STRENGTH = 3.0
SPREAD_FLOOR = 0.25
LOW_CONFIDENCE_BELOW = 3

METHOD = {
    "name": "shrunken per-judge z-score",
    "priorStrength": PRIOR_STRENGTH,
    "spreadFloor": SPREAD_FLOOR,
    "lowConfidenceBelow": LOW_CONFIDENCE_BELOW,
    "summary": (
        "Each judge's weighted totals are re-centred on their own (shrunken) mean and "
        "spread, then mapped back onto the event's 1-5 scale. Judges with few reviews "
        f"are pulled toward the event average by {PRIOR_STRENGTH:g} pseudo-reviews; a "
        f"judge's spread is never taken as less than {SPREAD_FLOOR:g}x the event spread."
    ),
}


@dataclass(frozen=True)
class Review:
    judge_id: str
    project_id: str
    total: float


@dataclass
class JudgeCalibration:
    judge_id: str
    reviews: int
    raw_mean: float
    raw_spread: float
    mean: float
    spread: float
    # Positive = scores above the event average (lenient); negative = harsh.
    leniency: float
    flat: bool


@dataclass
class ProjectScore:
    project_id: str
    reviews: int
    raw_mean: float
    normalized: float
    # Spread of normalized reviews: how much the judges disagreed.
    disagreement: float
    low_confidence: bool
    normalized_reviews: dict[str, float] = field(default_factory=dict)


@dataclass
class NormalizationResult:
    event_mean: float
    event_spread: float
    judges: dict[str, JudgeCalibration]
    projects: dict[str, ProjectScore]


def _mean(values: list[float]) -> float:
    return sum(values) / len(values)


def _pstdev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mu = _mean(values)
    return math.sqrt(sum((v - mu) ** 2 for v in values) / len(values))


def _clamp(value: float) -> float:
    return min(SCALE_MAX, max(SCALE_MIN, value))


def normalize(
    reviews: list[Review],
    *,
    prior_strength: float = PRIOR_STRENGTH,
    spread_floor: float = SPREAD_FLOOR,
) -> NormalizationResult:
    if not reviews:
        return NormalizationResult(0.0, 0.0, {}, {})

    totals = [r.total for r in reviews]
    event_mean = _mean(totals)
    event_spread = _pstdev(totals)

    by_judge: dict[str, list[Review]] = defaultdict(list)
    for review in reviews:
        by_judge[review.judge_id].append(review)

    judges: dict[str, JudgeCalibration] = {}
    for judge_id, items in by_judge.items():
        values = [r.total for r in items]
        n = len(values)
        raw_mean = _mean(values)
        raw_spread = _pstdev(values)
        k = prior_strength
        mean = (n * raw_mean + k * event_mean) / (n + k)
        spread = math.sqrt((n * raw_spread**2 + k * event_spread**2) / (n + k))
        spread = max(spread, spread_floor * event_spread)
        judges[judge_id] = JudgeCalibration(
            judge_id=judge_id,
            reviews=n,
            raw_mean=raw_mean,
            raw_spread=raw_spread,
            mean=mean,
            spread=spread,
            leniency=mean - event_mean,
            flat=n >= 2 and raw_spread == 0,
        )

    by_project: dict[str, dict[str, tuple[float, float]]] = defaultdict(dict)
    for review in reviews:
        calibration = judges[review.judge_id]
        if event_spread == 0 or calibration.spread == 0:
            # Every score in the event is identical: nothing to calibrate against.
            normalized = review.total
        else:
            z = (review.total - calibration.mean) / calibration.spread
            normalized = _clamp(event_mean + event_spread * z)
        by_project[review.project_id][review.judge_id] = (review.total, normalized)

    projects: dict[str, ProjectScore] = {}
    for project_id, per_judge in by_project.items():
        raws = [raw for raw, _ in per_judge.values()]
        norms = [norm for _, norm in per_judge.values()]
        projects[project_id] = ProjectScore(
            project_id=project_id,
            reviews=len(per_judge),
            raw_mean=_mean(raws),
            normalized=_mean(norms),
            disagreement=_pstdev(norms),
            low_confidence=len(per_judge) < LOW_CONFIDENCE_BELOW,
            normalized_reviews={judge: norm for judge, (_, norm) in per_judge.items()},
        )

    return NormalizationResult(event_mean, event_spread, judges, projects)


def competition_ranks(ordered_keys: list[str], values: dict[str, tuple]) -> dict[str, int]:
    """1-2-2-4 ranking: equal sort keys share a rank, the next rank skips."""
    ranks: dict[str, int] = {}
    previous = None
    for position, key in enumerate(ordered_keys, start=1):
        if values[key] != previous:
            rank = position
            previous = values[key]
        ranks[key] = rank
    return ranks
