"""Acceptance checks for what the official run.py doesn't cover: T3, the part
of T4 we built (bulk import/export), and the Normalization Proof bonus.

Same rules as run.py: Python 3.11+, standard library only, and it never logs
in (it uses the headers from .dogfood.toml). It changes no event data: every
request is a read, a dry run, or a write the portal must refuse. (The JSON
export is itself audited, so the audit trail gains an "exported" line.)

    python scripts/acceptance_extra.py .dogfood.toml

The official acceptance-report.txt stays exactly what run.py prints; this is
part of our own test suite, not a second report.
"""

import argparse
import json
import sys
import tomllib
import urllib.error
import urllib.request
from dataclasses import dataclass, field

TIERS = ["T3", "T4", "BONUS"]


@dataclass
class Check:
    tier: str
    label: str
    ok: bool = False
    detail: list[str] = field(default_factory=list)


class Portal:
    def __init__(self, cfg: dict):
        self.base = cfg["portal"]["base_url"].rstrip("/")
        self.auth = cfg.get("auth", {})

    def call(self, method: str, path: str, role: str | None = None, body: bytes | None = None):
        request = urllib.request.Request(self.base + path, data=body, method=method)
        if body is not None:
            request.add_header("Content-Type", "application/json")
        if role:
            name, _, value = self.auth[role].partition(":")
            request.add_header(name.strip(), value.strip())
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return response.status, response.read().decode("utf-8", "replace"), dict(response.headers)
        except urllib.error.HTTPError as err:
            return err.code, err.read().decode("utf-8", "replace"), dict(err.headers)
        except OSError as err:
            return 0, str(err), {}

    def json(self, method: str, path: str, role: str | None = None, body=None):
        raw = json.dumps(body).encode() if body is not None and not isinstance(body, bytes) else body
        status, text, _ = self.call(method, path, role, raw)
        try:
            return status, json.loads(text)
        except ValueError:
            return status, text


def run(cfg: dict, event: str) -> list[Check]:
    p = Portal(cfg)
    checks: list[Check] = []

    def check(tier: str, label: str, ok: bool, *detail: str) -> None:
        checks.append(Check(tier, label, bool(ok), [] if ok else [d for d in detail if d]))

    vote = f"/api/vote/{event}"
    org = f"/api/organizer/events/{event}"

    # ---------------------------------------------------------------- T3
    s, config = p.json("GET", f"{org}/voting", "organizer")
    state = config.get("config", {}).get("state") if isinstance(config, dict) else None
    published = config.get("config", {}).get("resultsPublished") if isinstance(config, dict) else None
    check("T3", "organizer reads voting settings", s == 200 and state,
          f"GET {org}/voting as organizer", f"got {s}, wanted 200 with a config")

    s, anon = p.json("GET", vote)
    check("T3", "voting access is enforced", s == 200 and isinstance(anon, dict) and anon.get("needs"),
          f"GET {vote} with no credentials", f"got {s} {str(anon)[:120]}",
          "wanted a ballot that asks to sign in / verify email / use the link")

    s, ballot_a = p.json("GET", vote, "participant")
    projects_a = ballot_a.get("projects", []) if isinstance(ballot_a, dict) else []
    check("T3", "voter gets a ballot", s == 200 and len(projects_a) >= 2,
          f"GET {vote} as participant", f"got {s}, {len(projects_a)} projects")

    tally_words = ("score", "supporters", "credits_total", "votes")
    leaked = [w for w in tally_words if any(w in proj for proj in projects_a)]
    check("T3", "ballot carries no vote counts", s == 200 and not leaked,
          f"ballot projects contain tally fields: {leaked}")

    s2, again = p.json("GET", vote, "participant")
    order_a = [x["id"] for x in projects_a]
    order_again = [x["id"] for x in again.get("projects", [])] if isinstance(again, dict) else []
    check("T3", "ballot order is stable for a voter", order_a and order_a == order_again,
          "the same voter saw a different order on reload")

    s, ballot_b = p.json("GET", vote, "judge_a")
    order_b = [x["id"] for x in ballot_b.get("projects", [])] if isinstance(ballot_b, dict) else []
    check("T3", "ballot order is randomised per voter",
          order_a and order_b and sorted(order_a) == sorted(order_b) and order_a != order_b,
          "participant and judge_a saw the same project order (or different project sets)")

    own = [x for x in projects_a if x.get("own")]
    others = [x["id"] for x in projects_a if not x.get("own")]
    if own:
        s, body = p.json("PUT", vote, "participant", {"allocations": {own[0]["id"]: 1}})
        check("T3", "voting for your own team is refused", s in (400, 403),
              f"PUT {vote} with credits on own project", f"got {s}, wanted 400 or 403")
    credits = (config.get("config", {}) if isinstance(config, dict) else {}).get("credits", 25)
    if others and state == "open":
        s, body = p.json("PUT", vote, "participant", {"allocations": {others[0]: credits + 1}})
        check("T3", "credit budget is enforced", s == 400,
              f"PUT {vote} spending {credits + 1} of {credits} credits", f"got {s}, wanted 400")

    s, _ = p.json("GET", f"{vote}/results", "participant")
    if state != "closed" or not published:
        check("T3", "results hidden from voters until published", s in (401, 403),
              f"GET {vote}/results as participant while {state}, unpublished={not published}",
              f"got {s}, wanted 401 or 403")
    else:
        check("T3", "published results are public", s == 200, f"got {s}, wanted 200")

    s, tally = p.json("GET", f"{org}/voting/results", "organizer")
    check("T3", "organizer sees the live tally", s == 200 and isinstance(tally, dict) and tally.get("projects"),
          f"GET {org}/voting/results as organizer", f"got {s}")
    s, _ = p.json("GET", f"{org}/voting/results", "participant")
    check("T3", "participant cannot see the tally", s in (401, 403), f"got {s}, wanted 401 or 403")

    s, voters = p.json("GET", f"{org}/voting/voters", "organizer")
    rows = voters.get("voters", []) if isinstance(voters, dict) else []
    check("T3", "duplicate / abuse flags on ballots", s == 200 and rows and all("flags" in r for r in rows),
          f"GET {org}/voting/voters as organizer", f"got {s}, {len(rows)} ballots")
    s, _ = p.json("GET", f"{org}/voting/voters", "judge_b")
    check("T3", "ballot review is organizer-only", s in (401, 403), f"as judge_b got {s}, wanted 401 or 403")

    target = others[0] if others else None
    if target:
        s, comments = p.json("GET", f"/api/projects/{target}/comments")
        check("T3", "comments are public to read", s == 200, f"GET /api/projects/{target}/comments got {s}")
        s, _ = p.json("POST", f"/api/projects/{target}/comments", None, {"body": "anonymous"})
        check("T3", "anonymous comments refused", s in (401, 403), f"got {s}, wanted 401 or 403")
        s, _ = p.json("POST", f"/api/projects/{target}/comments", "participant",
                      {"body": "a https://a.example b https://b.example c https://c.example"})
        check("T3", "link-spam comment refused", s == 400, f"got {s}, wanted 400")

    s, audit = p.json("GET", f"{org}/audit", "organizer")
    entries = audit.get("entries", []) if isinstance(audit, dict) else []
    readable = entries and all(e.get("label") and e.get("actor") for e in entries[:20])
    check("T3", "audit trail readable without a DB client", s == 200 and readable,
          f"GET {org}/audit as organizer", f"got {s}, {len(entries)} entries")
    s, _ = p.json("GET", f"{org}/audit", "participant")
    check("T3", "audit trail is organizer-only", s in (401, 403), f"got {s}, wanted 401 or 403")

    for kind in ("votes", "ballots", "comments", "audit"):
        s, text, headers = p.call("GET", f"/api/export.csv?event={event}&kind={kind}", "organizer")
        check("T3", f"csv export: {kind}", s == 200 and "," in text.splitlines()[0] if text else False,
              f"got {s}")
    s, _, _ = p.call("GET", f"/api/export.csv?event={event}&kind=ballots", "participant")
    check("T3", "vote exports refused to participants", s in (401, 403), f"got {s}, wanted 401 or 403")

    # ---------------------------------------------------------------- T4 (import / export only)
    s, dump = p.json("GET", f"{org}/export.json", "organizer")
    ok_dump = s == 200 and isinstance(dump, dict) and dump.get("format") == "hackboard-event/1"
    check("T4", "whole-event export (JSON)", ok_dump and dump.get("projects") and dump.get("scores"),
          f"GET {org}/export.json as organizer", f"got {s}")
    s, _ = p.json("GET", f"{org}/export.json", "participant")
    check("T4", "event export refused to participants", s in (401, 403), f"got {s}, wanted 401 or 403")

    if ok_dump:
        s, preview = p.json("POST", "/api/organizer/import?dry_run=true", "organizer", dump)
        summary = preview.get("summary", {}) if isinstance(preview, dict) else {}
        check("T4", "export re-imports cleanly (dry run)",
              s == 200 and summary.get("projects") == len(dump["projects"])
              and summary.get("scores") == len(dump["scores"]),
              "POST /api/organizer/import?dry_run=true with the export", f"got {s} {str(preview)[:160]}")
        broken = json.loads(json.dumps(dump))
        broken["projects"][0]["track"] = "trk_does_not_exist"
        s, refused = p.json("POST", "/api/organizer/import?dry_run=true", "organizer", broken)
        problems = (refused.get("detail") or {}).get("problems", []) if isinstance(refused, dict) else []
        check("T4", "bad import refused with every problem listed",
              s == 400 and any("trk_does_not_exist" in x for x in problems), f"got {s} {str(refused)[:160]}")
    s, _ = p.json("POST", "/api/organizer/import?dry_run=true", "participant", {"event": {}})
    check("T4", "import refused to participants", s in (401, 403), f"got {s}, wanted 401 or 403")

    # ---------------------------------------------------------------- Bonus: normalization proof
    s, results = p.json("GET", f"{org}/results", "organizer")
    projects = results.get("projects", []) if isinstance(results, dict) else []
    ranked = [r for r in projects if r.get("rank")]
    check("BONUS", "raw and normalized scores side by side",
          s == 200 and ranked and all(r.get("rawMean") is not None and r.get("normalized") is not None for r in ranked),
          f"GET {org}/results as organizer", f"got {s}")
    check("BONUS", "method is named in the output",
          isinstance(results, dict) and (results.get("method") or {}).get("name"), "no method in results")
    moved = [r for r in ranked if r.get("rawRank") and r["rawRank"] != r["rank"]]
    check("BONUS", "ranking change is visible", bool(moved),
          "no project's normalized rank differs from its raw rank")
    judges = results.get("judges", []) if isinstance(results, dict) else []
    check("BONUS", "per-judge calibration reported",
          judges and all("leniency" in j and "spread" in j for j in judges), "no judge calibration")
    s, _ = p.json("GET", f"{org}/results", "judge_b")
    check("BONUS", "results are organizer-only", s in (401, 403), f"as judge_b got {s}, wanted 401 or 403")

    return checks


def main() -> int:
    ap = argparse.ArgumentParser(description="Extra acceptance checks: T3, T4 import/export, bonus")
    ap.add_argument("config", help="path to .dogfood.toml")
    ap.add_argument("--event", default="sample-hack-2026", help="slug of the seeded fixture event")
    args = ap.parse_args()
    with open(args.config, "rb") as handle:
        cfg = tomllib.load(handle)

    checks = run(cfg, args.event)
    print("DOGFOOD 2026 extra acceptance report (T3, T4 import/export, bonus)")
    print(f"portal: {cfg['portal']['base_url']}")
    print(f"event:  {args.event}")
    print("scope:  T3 in full; T4 only bulk import/export (the rest of T4 is not built); Normalization Proof")
    print()
    width = 46
    for c in checks:
        dots = "." * max(2, width - len(c.label))
        print(f"{c.tier:<5}  {c.label} {dots} {'PASS' if c.ok else 'FAIL'}")
        for line in c.detail:
            print(f"         {line}")
    print()
    for tier in TIERS:
        mine = [c for c in checks if c.tier == tier]
        passed = sum(c.ok for c in mine)
        print(f"{tier:<5}  {passed}/{len(mine)} passed")
    return 0 if all(c.ok for c in checks) else 1


if __name__ == "__main__":
    sys.exit(main())
