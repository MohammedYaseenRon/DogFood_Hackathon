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
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  if (error && assignments.length === 0) {
    return (
      <EmptyState
        title="Judge access required"
        description="Log in as Judge A or Judge B to review assigned projects and scores."
        action={
          <ButtonLink href="/login" variant="primary">
            Sign in as judge
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/20">
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-100">Review progress</p>
              <p className="font-display mt-1 text-3xl font-bold text-white">
                {scored} / {total} scored
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-4xl font-bold text-white">{percent}%</p>
              <p className="text-xs text-emerald-100">complete</p>
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {rubric.length > 0 ? (
        <Card>
          <h2 className="font-display text-sm font-bold text-zinc-900">
            Scoring rubric
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {rubric.map((item) => (
              <Badge key={item.name} tone="cyan">
                {item.name} ×{item.weight}
              </Badge>
            ))}
          </div>
        </Card>
      ) : null}

      <Alert tone="info">
        Peer scores are hidden by the backend. You can only view and edit your own
        scores.
      </Alert>

      <div className="space-y-4">
        {assignments.map((item) => {
          const score = scores.find((s) => s.projectId === item.projectId);
          const isExpanded = expandedId === item.projectId;

          return (
            <Card
              key={item.projectId}
              className={`transition ${item.scored ? "border-emerald-200" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-zinc-900">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">{item.summary}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {score?.weightedTotal != null ? (
                    <span className="font-display text-lg font-bold text-violet-600">
                      {score.weightedTotal}
                    </span>
                  ) : null}
                  <Badge tone={item.scored ? "success" : "warning"}>
                    {item.scored ? "Scored" : "Pending"}
                  </Badge>
                </div>
              </div>
              <p className="mt-2 text-xs font-medium text-zinc-400">
                {item.trackName}
              </p>

              {score && !isExpanded ? (
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-4 text-sm">
                  {Object.entries(score.criteria).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-xl bg-zinc-50 px-3 py-2"
                    >
                      <p className="text-xs capitalize text-zinc-400">{key}</p>
                      <p className="font-bold text-zinc-900">{value}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {score?.comment && !isExpanded ? (
                <p className="mt-3 text-sm text-zinc-500">{score.comment}</p>
              ) : null}

              <div className="mt-4">
                {isExpanded && rubric.length > 0 ? (
                  <ScoreForm
                    projectId={item.projectId}
                    title={item.title}
                    rubric={rubric}
                    initialScore={score}
                    onSaved={handleSaved}
                  />
                ) : (
                  <Button
                    type="button"
                    variant={item.scored ? "secondary" : "primary"}
                    onClick={() =>
                      setExpandedId(isExpanded ? null : item.projectId)
                    }
                  >
                    {item.scored ? "Edit score" : "Score project"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
