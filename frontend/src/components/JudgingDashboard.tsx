"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchJudgeAssignmentsClient,
  fetchJudgeRubricClient,
  fetchJudgeScoresClient,
  type JudgeAssignment,
  type JudgeScore,
  type RubricCriterion,
} from "@/lib/api";
import { ScoreForm } from "@/components/ScoreForm";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export function JudgingDashboard() {
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([]);
  const [scores, setScores] = useState<JudgeScore[]>([]);
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    return Promise.all([
      fetchJudgeAssignmentsClient(),
      fetchJudgeScoresClient(),
      fetchJudgeRubricClient(),
    ]).then(([a, s, r]) => {
      setAssignments(a);
      setScores(s);
      setRubric(r);
      if (a.length === 0 && s.length === 0) {
        setError("Sign in as a judge to view assignments.");
      }
    });
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleSaved = (score: JudgeScore) => {
    setScores((prev) => {
      const rest = prev.filter((item) => item.projectId !== score.projectId);
      return [...rest, score];
    });
    setAssignments((prev) =>
      prev.map((item) =>
        item.projectId === score.projectId
          ? {
              ...item,
              scored: true,
              criteria: score.criteria,
              comment: score.comment,
              weightedTotal: score.weightedTotal,
            }
          : item,
      ),
    );
    setExpandedId(null);
  };

  const scored = assignments.filter((a) => a.scored).length;
  const total = assignments.length;
  const percent = total ? Math.round((scored / total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-ink" />
      </div>
    );
  }

  if (error && assignments.length === 0) {
    return (
      <EmptyState
        title="Judge access required"
        description="Sign in as Judge A or Judge B to review assigned projects and scores."
        action={
          <ButtonLink href="/login?mode=judge" variant="primary">
            Sign in as judge
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4 lg:order-1">
        {assignments.map((item, index) => {
          const score = scores.find((s) => s.projectId === item.projectId);
          const isExpanded = expandedId === item.projectId;

          return (
            <article
              key={item.projectId}
              className={`relative overflow-hidden rounded-2xl border bg-white p-5 pl-7 transition sm:p-6 sm:pl-8 ${
                isExpanded
                  ? "border-ink shadow-[0_12px_32px_-16px_rgba(21,19,43,0.3)]"
                  : "border-line hover:border-zinc-300"
              }`}
            >
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 w-1.5 ${item.scored ? "bg-emerald-500" : "bg-signal-300"}`}
              />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-400 uppercase">
                    #{String(index + 1).padStart(2, "0")} · {item.trackName}
                  </p>
                  <h3 className="font-display mt-1.5 text-lg font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-500">{item.summary}</p>
                </div>
                <div className="flex items-center gap-3">
                  {score?.weightedTotal != null ? (
                    <span className="font-display text-2xl font-semibold text-ink tabular-nums">
                      {score.weightedTotal}
                    </span>
                  ) : null}
                  <Badge tone={item.scored ? "success" : "warning"}>
                    {item.scored ? "Scored" : "Pending"}
                  </Badge>
                </div>
              </div>

              {score && !isExpanded ? (
                <dl className="mt-5 flex flex-wrap gap-2">
                  {Object.entries(score.criteria).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center gap-2 rounded-lg border border-line bg-zinc-50 py-1 pr-1 pl-3"
                    >
                      <dt className="text-xs text-zinc-500 capitalize">{key}</dt>
                      <dd className="font-display flex h-7 w-7 items-center justify-center rounded-md bg-white text-sm font-semibold text-ink ring-1 ring-line">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {score?.comment && !isExpanded ? (
                <p className="mt-3 border-l-2 border-line pl-3 text-sm text-zinc-600 italic">
                  {score.comment}
                </p>
              ) : null}

              <div className="mt-5">
                {isExpanded && rubric.length > 0 ? (
                  <ScoreForm
                    projectId={item.projectId}
                    title={item.title}
                    rubric={rubric}
                    initialScore={score}
                    onSaved={handleSaved}
                    onCancel={() => setExpandedId(null)}
                  />
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant={item.scored ? "secondary" : "primary"}
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
            <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">Your progress</p>
            <p className="font-display mt-3 text-5xl font-semibold tabular-nums">
              {scored}
              <span className="text-2xl text-white/40"> / {total}</span>
            </p>
            <p className="mt-1 text-sm text-white/60">
              {total - scored === 0 ? "All projects scored." : `${total - scored} left to score`}
            </p>
            <div
              className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Scoring progress"
            >
              <div
                className="h-full rounded-full bg-signal-300 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-2 text-right font-mono text-xs text-signal-300">{percent}%</p>

            {rubric.length > 0 ? (
              <div className="mt-6 border-t border-dashed border-white/15 pt-5">
                <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">Rubric</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {rubric.map((item) => (
                    <li key={item.name} className="flex items-center justify-between">
                      <span className="text-white/85 capitalize">{item.name}</span>
                      <span className="font-mono text-xs text-white/50">×{item.weight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
        <p className="rounded-xl border border-line bg-white p-4 text-sm leading-relaxed text-zinc-500">
          <span className="font-semibold text-ink">Blind scoring.</span> Other judges&apos; scores are
          hidden by the server. You only see and edit your own.
        </p>
      </aside>
    </div>
  );
}
