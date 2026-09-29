"use client";

import { useState } from "react";
import { saveEventRubricClient, type RubricCriterion } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/judging/shared";

type Row = { name: string; description: string; weight: string };

const toRows = (criteria: RubricCriterion[]): Row[] =>
  criteria.map((c) => ({ name: c.name, description: c.description ?? "", weight: String(c.weight) }));

export function RubricTab({
  slug,
  initial,
  locked,
  onSaved,
}: {
  slug: string;
  initial: RubricCriterion[];
  locked: boolean;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initial));
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const weights = rows.map((r) => Number(r.weight) || 0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    const res = await saveEventRubricClient(
      slug,
      rows.map((r) => ({ name: r.name.trim(), description: r.description.trim() || null, weight: Number(r.weight) })),
    );
    setSaving(false);
    if (res.error || !res.data) {
      setNotice({ tone: "error", text: res.error ?? "Could not save the rubric." });
      return;
    }
    setRows(toRows(res.data.criteria));
    setNotice({ tone: "success", text: "Rubric saved. Totals and results use the new weights immediately." });
    onSaved();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Panel
        title="Scoring rubric"
        description="Judges rate every criterion 1–5. A project's total is the weighted mean."
        action={
          !locked && rows.length < 10 ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setRows((prev) => [...prev, { name: "", description: "", weight: "1" }])}
            >
              + Add criterion
            </Button>
          ) : null
        }
      >
        {locked ? (
          <div className="mb-5">
            <Alert tone="info" title="Criteria are locked">
              Scoring has started, so criteria can&apos;t be added, removed or renamed. You can still change weights and
              descriptions; results recalculate instantly.
            </Alert>
          </div>
        ) : null}
        <ul className="space-y-3">
          {rows.map((row, index) => {
            const share = totalWeight ? Math.round(((Number(row.weight) || 0) / totalWeight) * 100) : 0;
            return (
              <li key={index} className="rounded-xl border border-line bg-zinc-50/70 p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_110px_auto] sm:items-end">
                  <div>
                    <label htmlFor={`rc-name-${index}`} className="field-label">
                      Criterion
                    </label>
                    <input
                      id={`rc-name-${index}`}
                      value={row.name}
                      disabled={locked}
                      maxLength={60}
                      onChange={(e) => update(index, { name: e.target.value })}
                      className="field capitalize"
                      placeholder="Impact"
                    />
                  </div>
                  <div>
                    <label htmlFor={`rc-weight-${index}`} className="field-label">
                      Weight
                    </label>
                    <input
                      id={`rc-weight-${index}`}
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={row.weight}
                      onChange={(e) => update(index, { weight: e.target.value })}
                      className="field"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-12 text-right font-mono text-sm font-semibold text-ink">{share}%</span>
                    {!locked && rows.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Remove ${row.name || "criterion"}`}
                        onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-600"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                </div>
                <label htmlFor={`rc-desc-${index}`} className="sr-only">
                  Guidance for {row.name}
                </label>
                <input
                  id={`rc-desc-${index}`}
                  value={row.description}
                  maxLength={300}
                  onChange={(e) => update(index, { description: e.target.value })}
                  className="field mt-2"
                  placeholder="Guidance judges see next to this criterion"
                />
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={() => void save()} disabled={saving || rows.some((r) => !r.name.trim() || !(Number(r.weight) > 0))}>
            {saving ? "Saving…" : "Save rubric"}
          </Button>
          {notice ? <span className={`text-sm ${notice.tone === "error" ? "text-red-600" : "text-emerald-700"}`}>{notice.text}</span> : null}
        </div>
      </Panel>

      <aside className="relative h-fit overflow-hidden rounded-2xl bg-ink p-6 text-white">
        <div aria-hidden className="graph-paper-dark absolute inset-0" />
        <div className="relative">
          <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">Weight split</p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/10">
            {rows.map((row, i) => (
              <span
                key={i}
                className={i % 2 ? "bg-signal-300/70" : "bg-signal-300"}
                style={{ width: `${totalWeight ? ((Number(row.weight) || 0) / totalWeight) * 100 : 0}%` }}
              />
            ))}
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {rows.map((row, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate text-white/80 capitalize">{row.name || "Untitled"}</span>
                <span className="font-mono text-xs text-white/50">×{row.weight || 0}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-dashed border-white/15 pt-4 text-xs leading-relaxed text-white/55">
            Weights are applied when scores are read, never stored in them, so re-weighting mid-judging is safe.
          </p>
        </div>
      </aside>
    </div>
  );
}
