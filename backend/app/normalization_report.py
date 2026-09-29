"""Run cross-judge normalization straight on fixtures.json and print a report.

    python -m app.normalization_report            # human-readable
    python -m app.normalization_report --csv      # standings as CSV

Uses the same `normalize()` the portal uses, with every rubric criterion
weighted 1 (the fixture rubric), so the numbers in NORMALIZATION.md can be
reproduced without a database.
"""

import csv
import sys
from collections import defaultdict

from app.seed import load_fixtures
from app.services.normalization import METHOD, Review, competition_ranks, normalize


def fixture_reviews(fixtures: dict) -> list[Review]:
    return [
        Review(s["judge"], s["project"], sum(s["criteria"].values()) / len(s["criteria"]))
        for s in fixtures["scores"]
        if s["criteria"]
    ]


def superseded(fixtures: dict) -> set[str]:
    """Earlier copies of a project a team submitted twice (same title)."""
    groups = defaultdict(list)
    for p in fixtures["projects"]:
        groups[(p["team"], p["title"].strip().casefold())].append(p)
    out = set()
    for items in groups.values():
        items.sort(key=lambda p: p["submitted_at"])
        out.update(p["id"] for p in items[:-1])
    return out


def main() -> None:
    fixtures = load_fixtures()
    titles = {p["id"]: p["title"] for p in fixtures["projects"]}
    names = {j["id"]: j["name"] for j in fixtures["judges"]}
    result = normalize(fixture_reviews(fixtures))
    dropped = superseded(fixtures)

    ranked = [p for p in result.projects.values() if p.project_id not in dropped]
    by_norm = sorted(ranked, key=lambda p: (-p.normalized, -p.raw_mean, titles[p.project_id]))
    by_raw = sorted(ranked, key=lambda p: (-p.raw_mean, titles[p.project_id]))
    norm_rank = competition_ranks([p.project_id for p in by_norm], {p.project_id: (round(p.normalized, 2),) for p in by_norm})
    raw_rank = competition_ranks([p.project_id for p in by_raw], {p.project_id: (round(p.raw_mean, 2),) for p in by_raw})

    if "--csv" in sys.argv:
        writer = csv.writer(sys.stdout, lineterminator="\n")
        writer.writerow(["rank", "raw_rank", "project_id", "title", "reviews", "raw_mean", "normalized", "low_confidence"])
        for p in by_norm:
            writer.writerow([
                norm_rank[p.project_id], raw_rank[p.project_id], p.project_id, titles[p.project_id],
                p.reviews, round(p.raw_mean, 3), round(p.normalized, 3), p.low_confidence,
            ])
        return

    moved = [p for p in ranked if norm_rank[p.project_id] != raw_rank[p.project_id]]
    top_raw = {p.project_id for p in ranked if raw_rank[p.project_id] <= 10}
    top_norm = {p.project_id for p in ranked if norm_rank[p.project_id] <= 10}

    print(f"method           {METHOD['name']} (k={METHOD['priorStrength']:g}, floor={METHOD['spreadFloor']:g})")
    print(f"reviews          {sum(p.reviews for p in result.projects.values())} over {len(result.projects)} projects, {len(result.judges)} judges")
    print(f"event mean/sd    {result.event_mean:.3f} / {result.event_spread:.3f}")
    print(f"not ranked       {', '.join(sorted(dropped)) or '-'} (superseded duplicate)")
    print(f"rank changed     {len(moved)} of {len(ranked)} projects; largest move "
          f"{max((abs(norm_rank[p.project_id] - raw_rank[p.project_id]) for p in ranked), default=0)} places")
    print(f"top-10 overlap   {len(top_raw & top_norm)} of 10")
    print(f"low confidence   {sum(p.low_confidence for p in ranked)} projects with < {METHOD['lowConfidenceBelow']} reviews")
    print()
    print(" rank  raw  reviews  raw    norm   project")
    for p in by_norm[:15]:
        print(f" {norm_rank[p.project_id]:>4} {raw_rank[p.project_id]:>4}  {p.reviews:>7}  {p.raw_mean:.2f}   {p.normalized:.2f}   "
              f"{titles[p.project_id]}{'  (low confidence)' if p.low_confidence else ''}")
    print()
    print(" judge calibration (most lenient/harsh first)")
    print(" leniency  spread  n   judge")
    for c in sorted(result.judges.values(), key=lambda c: -abs(c.leniency))[:10]:
        flag = "  flat" if c.flat else ""
        print(f" {c.leniency:+.3f}    {c.spread:.3f}  {c.reviews:<3} {names.get(c.judge_id, c.judge_id)}{flag}")


if __name__ == "__main__":
    main()
