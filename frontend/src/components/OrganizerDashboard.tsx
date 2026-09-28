"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchOrganizerStatsClient,
  type OrganizerJudgeProgress,
  type OrganizerStats,
} from "@/lib/api";
import { Button, ButtonLink } from "@/components/ui/Button";

type PaceFilter = "all" | "behind" | "active" | "done";
type SortKey = "pace" | "name" | "remaining";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDeadline(iso?: string) {
  if (!iso) return "No deadline set";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No deadline set";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function judgeStatus(judge: OrganizerJudgeProgress) {
  if (!judge.assigned) return "idle" as const;
  if (judge.completed >= judge.assigned) return "done" as const;
  if (judge.percent < 50) return "behind" as const;
  return "active" as const;
}

function remainingFor(judge: OrganizerJudgeProgress) {
  return judge.remaining ?? Math.max(judge.assigned - judge.completed, 0);
}

export function OrganizerDashboard() {
  const [stats, setStats] = useState<OrganizerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PaceFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("pace");

  const loadStats = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    const next = await fetchOrganizerStatsClient();
    setStats(next);
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadStats();
    const timer = window.setInterval(() => {
      void loadStats(true);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [loadStats]);

  const derived = useMemo(() => {
    if (!stats) return null;
    const remaining =
      stats.remainingAssignments ??
      Math.max(stats.totalAssignments - stats.totalScores, 0);
    const judgesComplete =
      stats.judgesComplete ??
      stats.judgeProgress.filter(
        (judge) => judge.assigned && judge.completed >= judge.assigned,
      ).length;
    const judgesBehind =
      stats.judgesBehind ??
      stats.judgeProgress.filter(
        (judge) => judge.assigned && judge.percent < 50,
      ).length;
    const average =
      stats.averageJudgePercent ??
      (stats.judgeProgress.length
        ? Math.round(
            (stats.judgeProgress.reduce((sum, judge) => sum + judge.percent, 0) /
              stats.judgeProgress.length) *
              10,
          ) / 10
        : 0);
    const attention = [...stats.judgeProgress]
      .filter((judge) => judgeStatus(judge) === "behind")
      .sort((a, b) => remainingFor(b) - remainingFor(a) || a.percent - b.percent)
      .slice(0, 5);

    return { remaining, judgesComplete, judgesBehind, average, attention };
  }, [stats]);

  const visibleJudges = useMemo(() => {
    if (!stats) return [];
    const needle = query.trim().toLowerCase();
    return stats.judgeProgress
      .filter((judge) => {
        const status = judgeStatus(judge);
        if (filter === "behind" && status !== "behind") return false;
        if (filter === "active" && status !== "active") return false;
        if (filter === "done" && status !== "done") return false;
        if (!needle) return true;
        return (
          judge.name.toLowerCase().includes(needle) ||
          (judge.email ?? "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        if (sortKey === "name") return a.name.localeCompare(b.name);
        if (sortKey === "remaining") return remainingFor(b) - remainingFor(a);
        if (a.percent !== b.percent) return a.percent - b.percent;
        return remainingFor(b) - remainingFor(a);
      });
  }, [filter, query, sortKey, stats]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  if (!stats || !derived) {
    return (
      <main className="min-h-screen bg-zinc-50/80 pb-16">
        <div className="border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">
              Organizer
            </p>
            <h1 className="font-display mt-2 text-3xl font-bold text-zinc-950">
              Organizer access needed
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              Sign in as an organizer to watch live scoring and export results.
            </p>
          </div>
        </div>
        <section className="mx-auto max-w-3xl px-6 py-12">
          <div className="rounded-[24px] border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/login">Sign in as organizer</ButtonLink>
              <ButtonLink href="/event" variant="secondary">
                View public event
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const completion = stats.completionPercent;
  const eventName = stats.event?.name ?? "Hackathon operations";
  const filters: Array<{ id: PaceFilter; label: string; count: number }> = [
    { id: "all", label: "All judges", count: stats.totalJudges },
    { id: "behind", label: "Behind", count: derived.judgesBehind },
    {
      id: "active",
      label: "In progress",
      count: stats.judgeProgress.filter((judge) => judgeStatus(judge) === "active")
        .length,
    },
    { id: "done", label: "Finished", count: derived.judgesComplete },
  ];

  return (
    <main className="min-h-screen bg-zinc-50/80 pb-16">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">
                Organizer
              </p>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                {refreshing ? "Refreshing…" : "Auto-refresh 20s"}
              </span>
            </div>
            <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-zinc-950">
              {eventName}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
              Track scoring in real time, spot judges who are falling behind, and
              export results when the room is ready.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/api/export.csv" size="sm">
              Download CSV
            </ButtonLink>
            <ButtonLink href="/organizer/event/edit" variant="secondary" size="sm">
              Manage event
            </ButtonLink>
            <ButtonLink href="/event" variant="secondary" size="sm">
              Public page
            </ButtonLink>
            <ButtonLink href="/projects" variant="secondary" size="sm">
              Gallery
            </ButtonLink>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Scoring complete"
            value={`${completion}%`}
            hint={`${stats.totalScores} / ${stats.totalAssignments} assignments`}
            accent
          />
          <MetricCard
            label="Projects in review"
            value={stats.totalProjects}
            hint="Submitted and fixture projects"
          />
          <MetricCard
            label="Active judges"
            value={stats.totalJudges}
            hint={`${derived.judgesComplete} finished scoring`}
          />
          <MetricCard
            label="Behind pace"
            value={derived.judgesBehind}
            hint={`${derived.remaining} reviews still open`}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
          <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-zinc-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-zinc-950">
                  Judge roster
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {visibleJudges.length} of {stats.totalJudges} shown
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 outline-none focus:border-violet-400"
                >
                  <option value="pace">Sort by slowest</option>
                  <option value="remaining">Sort by remaining</option>
                  <option value="name">Sort by name</option>
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void loadStats(true)}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing" : "Refresh now"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-b border-zinc-100 px-5 py-4">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search judges by name or email"
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-violet-400 focus:bg-white"
              />
              <div className="flex flex-wrap gap-2">
                {filters.map((item) => {
                  const active = filter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                        active
                          ? "bg-zinc-950 text-white"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                    >
                      {item.label}
                      <span className="ml-1.5 text-xs opacity-70">{item.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-zinc-100">
              {visibleJudges.length === 0 ? (
                <div className="px-5 py-16 text-center text-sm text-zinc-500">
                  No judges match this filter.
                </div>
              ) : (
                visibleJudges.map((judge) => {
                  const status = judgeStatus(judge);
                  const remaining = remainingFor(judge);
                  return (
                    <article
                      key={judge.id}
                      className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 font-display text-sm font-bold text-violet-700">
                          {initials(judge.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold text-zinc-950">
                              {judge.name}
                            </h3>
                            <StatusChip status={status} />
                          </div>
                          <p className="truncate text-sm text-zinc-500">
                            {judge.completed} of {judge.assigned} scored
                            {remaining ? ` · ${remaining} left` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="w-full sm:w-56">
                        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                          <span className="text-zinc-500">Progress</span>
                          <span className="text-zinc-900">{judge.percent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              status === "done"
                                ? "bg-emerald-500"
                                : status === "behind"
                                  ? "bg-amber-500"
                                  : "bg-gradient-to-r from-violet-600 to-cyan-500"
                            }`}
                            style={{ width: `${Math.min(judge.percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-bold text-zinc-950">
                Needs attention
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Judges below 50% completion, sorted by remaining work.
              </p>
              <div className="mt-5 space-y-3">
                {derived.attention.length === 0 ? (
                  <p className="rounded-2xl bg-emerald-50 px-4 py-5 text-sm font-medium text-emerald-800">
                    All judges are on pace. Nothing urgent right now.
                  </p>
                ) : (
                  derived.attention.map((judge) => (
                    <div
                      key={judge.id}
                      className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-zinc-900">{judge.name}</p>
                        <span className="text-sm font-bold text-amber-700">
                          {judge.percent}%
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-600">
                        {remainingFor(judge)} reviews still open
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm">
              <h2 className="font-display text-lg font-bold">Event pulse</h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-400">Submission window</dt>
                  <dd className="font-semibold">
                    {stats.event?.submissionsOpen ? "Open" : "Closed"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-400">Deadline</dt>
                  <dd className="text-right font-semibold">
                    {formatDeadline(stats.event?.submissionsClose)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-400">Reviews remaining</dt>
                  <dd className="font-semibold">{derived.remaining}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-400">Judges finished</dt>
                  <dd className="font-semibold">
                    {derived.judgesComplete} / {stats.totalJudges}
                  </dd>
                </div>
              </dl>
              <ButtonLink
                href="/organizer/event/edit"
                variant="white"
                className="mt-6 w-full"
              >
                Edit dates, tracks, prizes
              </ButtonLink>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] border p-5 shadow-sm ${
        accent
          ? "border-amber-200 bg-amber-50"
          : "border-zinc-200 bg-white"
      }`}
    >
      <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">
        {label}
      </p>
      <p className="font-display mt-3 text-3xl font-bold text-zinc-950">{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{hint}</p>
    </div>
  );
}

function StatusChip({ status }: { status: "idle" | "behind" | "active" | "done" }) {
  const styles = {
    idle: "bg-zinc-100 text-zinc-600",
    behind: "bg-amber-100 text-amber-800",
    active: "bg-violet-100 text-violet-700",
    done: "bg-emerald-100 text-emerald-800",
  };
  const labels = {
    idle: "Unassigned",
    behind: "Behind",
    active: "In progress",
    done: "Done",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

