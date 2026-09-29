"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJudgingOverviewClient, type JudgeStatus, type JudgingProgress } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { Label, Panel, StatusChip, statusLabel } from "@/components/judging/shared";

const FILTERS: Array<JudgeStatus | "all"> = ["all", "not_started", "in_progress", "done", "unassigned"];
const POLL_MS = 15_000;

/** Live per-judge progress; polls so an organizer can leave it open. */
export function ProgressTab({ slug, initial }: { slug: string; initial: JudgingProgress }) {
  const [progress, setProgress] = useState(initial);
  const [filter, setFilter] = useState<JudgeStatus | "all">("all");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const tick = () =>
      fetchJudgingOverviewClient(slug).then((res) => {
        if (!active || !res.data) return;
        setProgress(res.data.progress);
        setUpdatedAt(Date.now());
      });
    const timer = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [slug]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: progress.judges.length };
    for (const judge of progress.judges) {
      const key = judge.status ?? "unassigned";
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }, [progress]);

  const rows = progress.judges.filter((j) => filter === "all" || j.status === filter);
  const { totals } = progress;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-ink text-white">
        <div aria-hidden className="graph-paper-dark absolute inset-0" />
        <dl className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-white/10">
          {[
            ["Complete", `${totals.percent}%`, true],
            ["Scores in", `${totals.completed}/${totals.assignments}`, false],
            ["Panel", totals.panel, false],
            ["Not started", totals.notStarted, false],
            ["Finished", totals.done, false],
            ["Unreviewed projects", totals.projectsWithoutReviews, false],
          ].map(([label, value, accent]) => (
            <div key={String(label)} className="px-5 py-5">
              <dt className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">{label}</dt>
              <dd className={`font-display mt-2 text-2xl font-semibold tabular-nums ${accent ? "text-signal-300" : ""}`}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="relative h-1.5 bg-white/10">
          <div className="h-full bg-signal-300 transition-all" style={{ width: `${totals.percent}%` }} />
        </div>
      </div>

      <Panel
        title="Judges"
        description="Sorted by least progress first. Refreshes every 15 seconds."
        action={
          <span className="inline-flex items-center gap-2 font-mono text-[11px] text-zinc-500">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            {updatedAt ? `updated ${relativeTime(new Date(updatedAt).toISOString())}` : "live"}
          </span>
        }
      >
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter judges">
          {FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                filter === key
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-zinc-600 hover:border-zinc-400 hover:text-ink"
              }`}
            >
              {key === "all" ? "All" : statusLabel(key)}
              <span className="ml-1.5 font-mono text-xs opacity-60">{counts[key] ?? 0}</span>
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">No judges in this group.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((judge) => (
              <li key={judge.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_220px_120px] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-ink">{judge.name}</p>
                    {judge.status ? <StatusChip status={judge.status} /> : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {judge.tracks?.length ? judge.tracks.join(", ") : "All tracks"} · {judge.email}
                  </p>
                </div>
                <div>
                  <div className="mb-1 flex justify-between font-mono text-xs">
                    <span className="text-zinc-500">
                      {judge.completed}/{judge.assigned}
                    </span>
                    <span className="font-semibold text-ink">{judge.percent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={`h-full rounded-full ${
                        judge.status === "done"
                          ? "bg-emerald-500"
                          : judge.status === "not_started"
                            ? "bg-red-400"
                            : "bg-ink"
                      }`}
                      style={{ width: `${Math.max(judge.percent, judge.assigned ? 2 : 0)}%` }}
                    />
                  </div>
                </div>
                <div className="sm:text-right">
                  <Label className="sm:hidden">Last score</Label>
                  <p className="text-sm text-zinc-600">
                    {judge.lastActivity ? relativeTime(judge.lastActivity) : "—"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
