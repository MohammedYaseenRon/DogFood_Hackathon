"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchOrganizerEventsClient,
  fetchOrganizerStatsClient,
  type OrganizerEvent,
  type OrganizerJudgeProgress,
  type OrganizerStats,
} from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { phaseInfo } from "@/lib/format";
import { Eyebrow, MarkedTitle } from "@/components/ui/MarkedTitle";

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

/** Judging ops default to an event that actually has submissions to judge. */
function pickDefaultEvent(events: OrganizerEvent[]): string | null {
  const judging = events.find(
    (e) =>
      ["JUDGING", "SUBMISSIONS_CLOSED", "COMPLETED"].includes(e.phase) && e.counts.submitted > 0,
  );
  return (judging ?? events[0])?.slug ?? null;
}

export function OrganizerDashboard() {
  const [events, setEvents] = useState<OrganizerEvent[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [stats, setStats] = useState<OrganizerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PaceFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("pace");

  useEffect(() => {
    fetchOrganizerEventsClient().then((list) => {
      setEvents(list);
      if (!list || list.length === 0) {
        setLoading(false);
        return;
      }
      setSelected(pickDefaultEvent(list));
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    const load = () =>
      fetchOrganizerStatsClient(selected).then((next) => {
        if (!active) return;
        setStats(next);
        setRefreshing(false);
        setLoading(false);
      });
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selected]);

  async function refreshNow() {
    if (!selected) return;
    setRefreshing(true);
    setStats(await fetchOrganizerStatsClient(selected));
    setRefreshing(false);
  }

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
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-300 border-t-ink" />
      </div>
    );
  }

  if (events && events.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-50/80 pb-16">
        <section className="mx-auto max-w-3xl px-6 py-16">
          <div className="rounded-2xl border border-line bg-white p-8 text-center">
            <h1 className="font-display text-2xl font-semibold text-ink">No events yet</h1>
            <p className="mt-2 text-sm text-zinc-500">Create your first hackathon to open registration.</p>
            <ButtonLink href="/organizer/event/new" className="mt-6">
              Create event
            </ButtonLink>
          </div>
        </section>
      </main>
    );
  }

  if (!stats || !derived) {
    return (
      <main className="min-h-screen bg-zinc-50/80 pb-16">
        <div className="border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <p className="text-xs font-semibold tracking-[0.18em] text-brand-600 uppercase">
              Organizer
            </p>
            <h1 className="font-display mt-2 text-3xl font-semibold text-ink">
              Organizer access needed
            </h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              Sign in as an organizer to watch live scoring and export results.
            </p>
          </div>
        </div>
        <section className="mx-auto max-w-3xl px-6 py-12">
          <div className="rounded-2xl border border-line bg-white p-8">
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/login?mode=organizer&redirect=/organizer/dashboard">
                Sign in as organizer
              </ButtonLink>
              <ButtonLink href="/events" variant="secondary">
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
  const eventSlug = stats.event?.slug ?? selected ?? "";
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
    <main className="pb-24">
      <header className="relative">
        <div aria-hidden className="graph-paper absolute inset-0" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-5 pb-10 pt-12 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:pt-16">
          <div className="max-w-3xl">
            <Eyebrow>Organizer / judging ops</Eyebrow>
            <h1 className="font-display mt-4 text-[1.9rem] leading-[1.12] font-semibold text-ink sm:text-[2.6rem]">
              <MarkedTitle text={eventName} />
            </h1>
            <p className="mt-4 flex flex-wrap items-center gap-2 text-base text-zinc-600">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500">
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${refreshing ? "bg-signal-400" : "bg-emerald-500"}`} />
                {refreshing ? "refreshing…" : "live · refreshes every 20s"}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <label className="flex items-center gap-2 font-mono text-xs text-zinc-500 uppercase">
              Event
              <select
                value={selected ?? ""}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setRefreshing(true);
                }}
                className="h-9 rounded-lg border border-line bg-white px-3 font-sans text-sm font-semibold text-ink normal-case outline-none focus:border-brand-500"
              >
                {(events ?? []).map((event) => (
                  <option key={event.slug} value={event.slug}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/organizer/events/${eventSlug}/judging`} variant="signal" size="sm">
                Judging console
              </ButtonLink>
              <a
                href={`/api/export.csv?event=${encodeURIComponent(eventSlug)}`}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-ink px-3.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Download CSV
              </a>
              <ButtonLink href={`/organizer/events/${eventSlug}`} variant="secondary" size="sm">
                Manage event
              </ButtonLink>
              <ButtonLink href="/organizer/event/new" variant="signal" size="sm">
                + New event
              </ButtonLink>
            </div>
          </div>
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-5 sm:px-6">
        <EventsTable events={events ?? []} selected={eventSlug} />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Scoring complete"
            value={`${completion}%`}
            hint={`${stats.totalScores} / ${stats.totalAssignments} assignments`}
            accent
          />
          <MetricCard
            label="Projects in review"
            value={stats.totalProjects}
            hint={`${stats.event?.counts?.submitted ?? 0} submitted · ${stats.event?.counts?.drafts ?? 0} drafts`}
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
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="flex flex-col gap-4 border-b border-zinc-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
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
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 outline-none focus:border-brand-400"
                >
                  <option value="pace">Sort by slowest</option>
                  <option value="remaining">Sort by remaining</option>
                  <option value="name">Sort by name</option>
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void refreshNow()}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing" : "Refresh now"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-b border-line bg-zinc-50/60 px-5 py-4">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search judges by name or email"
                aria-label="Search judges"
                type="search"
                className="field"
              />
              <div className="flex flex-wrap gap-2">
                {filters.map((item) => {
                  const active = filter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id)}
                      aria-pressed={active}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                        active
                          ? "border-ink bg-ink text-white"
                          : "border-line bg-white text-zinc-600 hover:border-zinc-400 hover:text-ink"
                      }`}
                    >
                      {item.label}
                      <span className="ml-1.5 font-mono text-xs opacity-60">{item.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-line">
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
                        <div
                          className={`font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                            status === "done"
                              ? "bg-emerald-600 text-white"
                              : status === "behind"
                                ? "bg-signal-300 text-ink"
                                : "bg-ink text-white"
                          }`}
                        >
                          {initials(judge.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold text-ink">
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
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-mono text-[10px] tracking-[0.12em] text-zinc-500 uppercase">Progress</span>
                          <span className="font-mono text-xs font-semibold text-ink">{judge.percent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              status === "done"
                                ? "bg-emerald-500"
                                : status === "behind"
                                  ? "bg-signal-400"
                                  : "bg-ink"
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
            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-display text-lg font-semibold text-ink">
                Needs attention
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Judges below 50% completion, sorted by remaining work.
              </p>
              <div className="mt-5 space-y-3">
                {derived.attention.length === 0 ? (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm font-medium text-emerald-800">
                    All judges are on pace. Nothing urgent right now.
                  </p>
                ) : (
                  derived.attention.map((judge) => (
                    <div
                      key={judge.id}
                      className="relative overflow-hidden rounded-xl border border-line bg-white py-3 pr-4 pl-5"
                    >
                      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-signal-300" />
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-ink">{judge.name}</p>
                        <span className="font-mono text-sm font-semibold text-ink">
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

            <div className="rounded-2xl bg-ink p-5 text-white">
              <h2 className="font-display text-lg font-semibold">Event pulse</h2>
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
                href={`/organizer/events/${eventSlug}/edit`}
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

function EventsTable({ events, selected }: { events: OrganizerEvent[]; selected: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Your events</h2>
          <p className="mt-1 text-sm text-zinc-500">Every event on this portal, latest deadline first.</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Event</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Deadline</th>
              <th className="px-5 py-3 text-right font-semibold">Teams</th>
              <th className="px-5 py-3 text-right font-semibold">Submitted</th>
              <th className="px-5 py-3 text-right font-semibold">Drafts</th>
              <th className="px-5 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const phase = phaseInfo(event.phase);
              return (
                <tr
                  key={event.slug}
                  className={`border-t border-zinc-100 ${event.slug === selected ? "bg-brand-50/50" : ""}`}
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/organizer/events/${event.slug}`}
                      className="font-semibold text-zinc-900 hover:text-brand-700"
                    >
                      {event.name}
                    </Link>
                    {!event.published ? (
                      <span className="ml-2">
                        <Badge tone="warning">Hidden</Badge>
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={phase.tone}>{phase.label}</Badge>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-zinc-600">
                    {formatDeadline(event.submissionsClose)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{event.counts.teams}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{event.counts.submitted}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{event.counts.drafts}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/organizer/events/${event.slug}/edit`}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
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
    <div className={`rounded-2xl p-5 ${accent ? "bg-ink text-white" : "border border-line bg-white text-ink"}`}>
      <p className={`font-mono text-[11px] tracking-[0.14em] uppercase ${accent ? "text-white/55" : "text-zinc-500"}`}>
        {label}
      </p>
      <p className={`font-display mt-3 text-3xl font-semibold tabular-nums ${accent ? "text-signal-300" : "text-ink"}`}>
        {value}
      </p>
      <p className={`mt-1 text-sm ${accent ? "text-white/65" : "text-zinc-500"}`}>{hint}</p>
    </div>
  );
}

function StatusChip({ status }: { status: "idle" | "behind" | "active" | "done" }) {
  const styles = {
    idle: "bg-zinc-100 text-zinc-600 ring-zinc-200",
    behind: "bg-signal-100 text-signal-600 ring-signal-200",
    active: "bg-brand-50 text-brand-700 ring-brand-200",
    done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  const labels = {
    idle: "Unassigned",
    behind: "Behind",
    active: "In progress",
    done: "Done",
  };
  return (
    <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

