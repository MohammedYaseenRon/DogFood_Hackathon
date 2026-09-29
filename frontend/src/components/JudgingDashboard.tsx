"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchJudgeAssignmentsClient,
  fetchJudgeEventsClient,
  fetchJudgeScoresClient,
  type JudgeAssignment,
  type JudgeEvent,
  type JudgeScore,
} from "@/lib/api";
import { ScoreForm } from "@/components/ScoreForm";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

type Loaded = { events: JudgeEvent[]; assignments: JudgeAssignment[]; scores: JudgeScore[] } | null;

async function loadAll(): Promise<Loaded> {
  const events = await fetchJudgeEventsClient();
  if (!events) return null;
  const [assignments, scores] = await Promise.all([fetchJudgeAssignmentsClient(), fetchJudgeScoresClient()]);
  return { events, assignments, scores };
}

export function JudgingDashboard() {
  const [data, setData] = useState<Loaded | undefined>(undefined);
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todo" | "all">("todo");

  useEffect(() => {
    let active = true;
    loadAll().then((loaded) => {
      if (!active) return;
      setData(loaded);
      setEventSlug(loaded?.events[0]?.slug ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-ink" />
      </div>
    );
  }

  if (data === null) {
    return (
      <EmptyState
        title="Judge access required"
        description="Sign in with a judge account to review your assigned projects."
        action={
          <ButtonLink href="/login?mode=judge&redirect=/judging" variant="primary">
            Sign in as judge
          </ButtonLink>
        }
      />
    );
  }

  if (data.events.length === 0) {
    return (
      <EmptyState
        title="You're not on a judge panel yet"
        description="Ask an organizer for a judge invite link. Once you accept it, your assigned projects appear here."
      />
    );
  }

  const event = data.events.find((e) => e.slug === eventSlug) ?? data.events[0];
  const assignments = data.assignments.filter((a) => a.eventSlug === event.slug);
  const scored = assignments.filter((a) => a.scored).length;
  const total = assignments.length;
  const percent = total ? Math.round((scored / total) * 100) : 0;
  const visible = filter === "todo" ? assignments.filter((a) => !a.scored || a.projectId === expandedId) : assignments;

  const handleSaved = (score: JudgeScore) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            scores: [...prev.scores.filter((s) => s.projectId !== score.projectId), score],
            assignments: prev.assignments.map((item) =>
              item.projectId === score.projectId
                ? { ...item, scored: true, criteria: score.criteria, comment: score.comment, weightedTotal: score.weightedTotal }
                : item,
            ),
          }
        : prev,
    );
    setExpandedId(null);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4 lg:order-1">
        {data.events.length > 1 ? (
          <div role="tablist" aria-label="Events" className="flex flex-wrap gap-2">
            {data.events.map((item) => (
              <button
                key={item.slug}
                role="tab"
                type="button"
                aria-selected={item.slug === event.slug}
                onClick={() => {
                  setEventSlug(item.slug);
                  setExpandedId(null);
                }}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                  item.slug === event.slug ? "border-ink bg-ink text-white" : "border-line bg-white text-zinc-600 hover:border-zinc-400"
                }`}
              >
                {item.name}
                <span className="ml-1.5 font-mono text-xs opacity-60">
                  {item.completed}/{item.assigned}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {!event.scoringOpen && event.scoringBlockReason ? (
          <Alert tone="info" title="Scoring is closed">
            {event.scoringBlockReason}
          </Alert>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <div role="group" aria-label="Show" className="inline-flex rounded-lg border border-line bg-white p-1">
            {(["todo", "all"] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  filter === key ? "bg-ink text-white" : "text-zinc-500 hover:text-ink"
                }`}
              >
                {key === "todo" ? `To score · ${total - scored}` : `All · ${total}`}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={total ? "All caught up" : "No assignments yet"}
            description={
              total
                ? "You've scored every project assigned to you. You can still edit scores under All."
                : "The organizer hasn't assigned you any projects for this event yet."
            }
          />
        ) : null}

        {visible.map((item, index) => {
          const score = data.scores.find((s) => s.projectId === item.projectId);
          const isExpanded = expandedId === item.projectId;
          return (
            <article
              key={item.projectId}
              className={`relative overflow-hidden rounded-2xl border bg-white p-5 pl-7 transition sm:p-6 sm:pl-8 ${
                isExpanded ? "border-ink shadow-[0_12px_32px_-16px_rgba(21,19,43,0.3)]" : "border-line hover:border-zinc-300"
              }`}
            >
              <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${item.scored ? "bg-emerald-500" : "bg-signal-300"}`} />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-400 uppercase">
                    #{String(index + 1).padStart(2, "0")} · {item.trackName}
                  </p>
                  <h3 className="font-display mt-1.5 text-lg font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-500">{item.tagline || item.summary}</p>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
                    <Link href={`/projects/${item.projectId}`} className="text-brand-700 underline-offset-4 hover:underline">
                      Open project →
                    </Link>
                    {item.repoUrl ? (
                      <a href={item.repoUrl} target="_blank" rel="noreferrer" className="text-zinc-600 underline-offset-4 hover:underline">
                        Repo ↗
                      </a>
                    ) : null}
                    {item.liveUrl ? (
                      <a href={item.liveUrl} target="_blank" rel="noreferrer" className="text-zinc-600 underline-offset-4 hover:underline">
                        Live ↗
                      </a>
                    ) : null}
                    {item.videoUrl ? (
                      <a href={item.videoUrl} target="_blank" rel="noreferrer" className="text-zinc-600 underline-offset-4 hover:underline">
                        Video ↗
                      </a>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {score?.weightedTotal != null ? (
                    <span className="font-display text-2xl font-semibold text-ink tabular-nums">{score.weightedTotal}</span>
                  ) : null}
                  <Badge tone={item.scored ? "success" : "warning"}>{item.scored ? "Scored" : "Pending"}</Badge>
                </div>
              </div>

              {score && !isExpanded ? (
                <dl className="mt-5 flex flex-wrap gap-2">
                  {event.rubric.map((criterion) => (
                    <div key={criterion.name} className="flex items-center gap-2 rounded-lg border border-line bg-zinc-50 py-1 pr-1 pl-3">
                      <dt className="text-xs text-zinc-500 capitalize">{criterion.name}</dt>
                      <dd className="font-display flex h-7 w-7 items-center justify-center rounded-md bg-white text-sm font-semibold text-ink ring-1 ring-line">
                        {score.criteria[criterion.name] ?? "–"}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {score?.comment && !isExpanded ? (
                <p className="mt-3 border-l-2 border-line pl-3 text-sm text-zinc-600 italic">{score.comment}</p>
              ) : null}

              <div className="mt-5">
                {isExpanded ? (
                  <ScoreForm
                    projectId={item.projectId}
                    title={item.title}
                    rubric={event.rubric}
                    initialScore={score}
                    onSaved={handleSaved}
                    onCancel={() => setExpandedId(null)}
                  />
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant={item.scored ? "secondary" : "primary"}
                    disabled={!event.scoringOpen}
                    onClick={() => setExpandedId(item.projectId)}
                  >
                    {item.scored ? "Edit score" : "Score project →"}
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <aside className="space-y-4 lg:order-2">
        <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white lg:sticky lg:top-24">
          <div aria-hidden className="graph-paper-dark absolute inset-0" />
          <div className="relative">
            <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">{event.name}</p>
            <p className="font-display mt-3 text-5xl font-semibold tabular-nums">
              {scored}
              <span className="text-2xl text-white/40"> / {total}</span>
            </p>
            <p className="mt-1 text-sm text-white/60">
              {total === 0 ? "Nothing assigned yet" : total - scored === 0 ? "All projects scored." : `${total - scored} left to score`}
            </p>
            <div
              className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Scoring progress"
            >
              <div className="h-full rounded-full bg-signal-300 transition-all" style={{ width: `${percent}%` }} />
            </div>

            <div className="mt-6 border-t border-dashed border-white/15 pt-5">
              <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">Your tracks</p>
              <p className="mt-2 text-sm text-white/85">{event.allTracks ? "Every track" : event.tracks.join(", ")}</p>
            </div>

            {event.rubric.length > 0 ? (
              <div className="mt-5 border-t border-dashed border-white/15 pt-5">
                <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">Rubric · 1–5 each</p>
                <ul className="mt-3 space-y-3 text-sm">
                  {event.rubric.map((item) => (
                    <li key={item.name}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white/90 capitalize">{item.name}</span>
                        <span className="font-mono text-xs text-white/50">×{item.weight}</span>
                      </div>
                      {item.description ? <p className="mt-0.5 text-xs leading-relaxed text-white/55">{item.description}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
        <p className="rounded-xl border border-line bg-white p-4 text-sm leading-relaxed text-zinc-500">
          <span className="font-semibold text-ink">Blind scoring.</span> Other judges&apos; scores are hidden by the server,
          and you only see projects in your tracks.
        </p>
      </aside>
    </div>
  );
}
