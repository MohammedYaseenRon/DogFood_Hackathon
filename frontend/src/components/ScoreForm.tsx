"use client";

import { useMemo, useState } from "react";
import {
  submitJudgeScoreClient,
  type JudgeScore,
  type RubricCriterion,
} from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type ScoreFormProps = {
  projectId: string;
  title: string;
  rubric: RubricCriterion[];
  initialScore?: JudgeScore;
  onSaved: (score: JudgeScore) => void;
};

function previewTotal(
  criteria: Record<string, number>,
  rubric: RubricCriterion[],
): number {
  const weights = Object.fromEntries(rubric.map((item) => [item.name, item.weight]));
  const names = Object.keys(criteria);
  const totalWeight = names.reduce((sum, name) => sum + (weights[name] ?? 1), 0);
  if (!totalWeight) return 0;
  const numerator = names.reduce(
    (sum, name) => sum + criteria[name] * (weights[name] ?? 1),
    0,
  );
  return Math.round((numerator / totalWeight) * 100) / 100;
}

export function ScoreForm({
  projectId,
  title,
  rubric,
  initialScore,
  onSaved,
}: ScoreFormProps) {
  const defaults = useMemo(() => {
    const values: Record<string, number> = {};
    for (const item of rubric) {
      values[item.name] = initialScore?.criteria[item.name] ?? 3;
    }
    return values;
  }, [initialScore, rubric]);

  const [criteria, setCriteria] = useState(defaults);
  const [comment, setComment] = useState(initialScore?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const weightedTotal = previewTotal(criteria, rubric);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { score, error: submitError } = await submitJudgeScoreClient({
      project_id: projectId,
      criteria,
      comment,
    });

    setSaving(false);
    if (!score) {
      setError(submitError ?? "Failed to save score.");
      return;
    }

    onSaved(score);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">Score {title}</p>
        <p className="text-sm text-slate-500">
          Weighted total:{" "}
          <span className="font-semibold text-indigo-600">{weightedTotal}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {rubric.map((item) => (
          <div key={item.name} className="rounded-xl bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium capitalize text-slate-700">
                {item.name}
              </label>
              <span className="text-xs text-slate-500">×{item.weight}</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={criteria[item.name]}
                onChange={(e) =>
                  setCriteria((prev) => ({
                    ...prev,
                    [item.name]: Number(e.target.value),
                  }))
                }
                className="w-full accent-indigo-600"
              />
              <span className="w-6 text-center text-sm font-semibold text-slate-900">
                {criteria[item.name]}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Comment
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          placeholder="Optional feedback for the team"
        />
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : initialScore ? "Update score" : "Submit score"}
      </Button>
    </form>
  );
}
