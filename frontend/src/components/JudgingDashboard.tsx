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
    return <p className="text-slate-500">Loading judge dashboard...</p>;
  }

  if (error && assignments.length === 0) {
    return (
      <EmptyState
        title="Judge access required"
        description="Log in as Judge A or Judge B to review assigned projects and scores."
        action={
          <ButtonLink href="/login" variant="primary">
            Go to login
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Review progress</p>
            <p className="text-2xl font-bold text-slate-900">
              {scored} / {total} scored
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-indigo-600">{percent}%</p>
            <p className="text-xs text-slate-500">complete</p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </Card>

      {rubric.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Scoring rubric</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {rubric.map((item) => (
              <Badge key={item.name} tone="default">
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

      <div className="space-y-3">
        {assignments.map((item) => {
          const score = scores.find((s) => s.projectId === item.projectId);
          const isExpanded = expandedId === item.projectId;

          return (
            <Card key={item.projectId}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{item.summary}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {score?.weightedTotal != null ? (
                    <span className="text-sm font-semibold text-indigo-600">
                      {score.weightedTotal}
                    </span>
                  ) : null}
                  <Badge tone={item.scored ? "success" : "warning"}>
                    {item.scored ? "Scored" : "Pending"}
                  </Badge>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">{item.trackName}</p>

              {score && !isExpanded ? (
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-sm">
                  {Object.entries(score.criteria).map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs capitalize text-slate-500">{key}</p>
                      <p className="font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {score?.comment && !isExpanded ? (
                <p className="mt-3 text-sm text-slate-600">{score.comment}</p>
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
