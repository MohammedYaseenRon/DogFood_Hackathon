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
  onCancel?: () => void;
};

const SCALE = [1, 2, 3, 4, 5] as const;

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
  onCancel,
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
    <form onSubmit={handleSubmit} className="space-y-5 border-t border-dashed border-line pt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
          Scoresheet · {title}
        </p>
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
            Weighted
          </span>
          <span className="font-display text-2xl font-semibold text-ink tabular-nums">
            <span className="hl">{weightedTotal.toFixed(2)}</span>
          </span>
          <span className="text-sm text-zinc-400">/ 5</span>
        </p>
      </div>

      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {rubric.map((item) => (
          <fieldset
            key={item.name}
            className="flex flex-col gap-3 bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <legend className="sr-only">
              {item.name}, weight {item.weight}
            </legend>
            <div className="flex items-baseline gap-2" aria-hidden>
              <span className="text-sm font-semibold text-ink capitalize">{item.name}</span>
              <span className="font-mono text-[11px] text-zinc-400">×{item.weight}</span>
            </div>
            <div className="flex gap-1.5">
              {SCALE.map((value) => {
                const selected = criteria[item.name] === value;
                return (
                  <label
                    key={value}
                    className={`font-display flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 ${
                      selected
                        ? "border-ink bg-signal-300 text-ink shadow-[inset_0_-2px_0_rgba(21,19,43,0.18)]"
                        : "border-line bg-white text-zinc-500 hover:border-zinc-400 hover:text-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${projectId}-${item.name}`}
                      value={value}
                      checked={selected}
                      onChange={() =>
                        setCriteria((prev) => ({ ...prev, [item.name]: value }))
                      }
                      className="sr-only"
                      aria-label={`${item.name}: ${value}`}
                    />
                    {value}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div>
        <label htmlFor={`comment-${projectId}`} className="field-label">
          Comment
        </label>
        <textarea
          id={`comment-${projectId}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="field"
          placeholder="Optional feedback for the team"
        />
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : initialScore ? "Update score" : "Submit score"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
