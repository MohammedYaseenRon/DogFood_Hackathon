"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assignBatchClient,
  autoAssignClient,
  fetchAssignmentsClient,
  unassignClient,
  type AssignmentCoverage,
  type AssignmentRow,
  type AutoAssignResult,
  type OrganizerJudgeProgress,
} from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Label, Panel, Spinner } from "@/components/judging/shared";

type Data = { assignments: AssignmentRow[]; projects: AssignmentCoverage[] };

export function AssignmentsTab({
  slug,
  judges,
  onChange,
}: {
  slug: string;
  judges: OrganizerJudgeProgress[];
  onChange: () => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [trackFilter, setTrackFilter] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);

  const load = useCallback(
    () =>
      fetchAssignmentsClient(slug).then((res) => {
        if (res.data) setData(res.data);
      }),
    [slug],
  );

  useEffect(() => {
    let active = true;
    fetchAssignmentsClient(slug).then((res) => {
      if (active && res.data) setData(res.data);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  const tracks = useMemo(
    () => Array.from(new Set((data?.projects ?? []).map((p) => p.track).filter(Boolean))) as string[],
    [data],
  );

  if (!data) return <Spinner />;

  const projects = data.projects.filter((p) => !trackFilter || p.track === trackFilter);
  const byProject = new Map<string, AssignmentRow[]>();
  for (const row of data.assignments) {
    byProject.set(row.projectId, [...(byProject.get(row.projectId) ?? []), row]);
  }

  async function refresh(text: string, tone: "success" | "warning" = "success") {
    setNotice({ tone, text });
    await load();
    onChange();
  }

  return (
    <div className="space-y-6">
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <AutoAssign slug={slug} onApplied={(r) => void refresh(autoMessage(r), r.shortfalls.length ? "warning" : "success")} />
        <BatchAssign
          slug={slug}
          judges={judges}
          projects={data.projects.filter((p) => !p.duplicateOf)}
          onDone={(text, tone) => void refresh(text, tone)}
        />
      </div>

      <Panel
        title="Coverage"
        description="Reviews assigned and scored per project, fewest first."
        action={
          <select
            aria-label="Filter by track"
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="field w-auto py-2"
          >
            <option value="">All tracks</option>
            {tracks.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        }
      >
        <ul className="divide-y divide-line">
          {projects.map((project) => {
            const rows = byProject.get(project.projectId) ?? [];
            const expanded = open === project.projectId;
            return (
              <li key={project.projectId} className="py-3">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : project.projectId)}
                  className="flex w-full flex-wrap items-center gap-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{project.title}</span>
                    <span className="text-xs text-zinc-500">{project.track}</span>
                  </span>
                  {project.duplicateOf ? <Badge tone="warning">Duplicate of {project.duplicateOf}</Badge> : null}
                  {project.assigned === 0 && !project.duplicateOf ? <Badge tone="danger">No judges</Badge> : null}
                  <span className="flex gap-1" aria-label={`${project.scored} of ${project.assigned} reviews scored`}>
                    {rows.map((row) => (
                      <span
                        key={row.judgeId}
                        className={`h-3 w-3 rounded-[3px] ${row.scored ? "bg-emerald-500" : "border border-zinc-300 bg-white"}`}
                      />
                    ))}
                  </span>
                  <span className="w-12 text-right font-mono text-xs text-zinc-500">
                    {project.scored}/{project.assigned}
                  </span>
                </button>
                {expanded ? (
                  <ul className="mt-3 space-y-1.5 rounded-xl bg-zinc-50 p-3">
                    {rows.length === 0 ? <li className="text-sm text-zinc-500">No judges assigned.</li> : null}
                    {rows.map((row) => (
                      <li key={row.judgeId} className="flex items-center justify-between gap-3 text-sm">
                        <span>
                          <span className="font-medium text-ink">{row.judgeName}</span>
                          <span className="ml-2 font-mono text-[11px] text-zinc-400">{row.batch}</span>
                        </span>
                        {row.scored ? (
                          <Badge tone="success">Scored</Badge>
                        ) : (
                          <button
                            type="button"
                            className="font-mono text-[11px] text-red-600 uppercase hover:underline"
                            onClick={async () => {
                              const res = await unassignClient(slug, row.judgeId, row.projectId);
                              if (res.error) setNotice({ tone: "error", text: res.error });
                              else await refresh(`${row.judgeName} unassigned from ${row.title}.`);
                            }}
                          >
                            Unassign
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

function autoMessage(result: AutoAssignResult) {
  const base = `Created ${result.created ?? result.planned} assignments in "${result.batch}".`;
  return result.shortfalls.length
    ? `${base} ${result.shortfalls.length} projects still lack reviewers: add judges to their tracks.`
    : base;
}

function AutoAssign({ slug, onApplied }: { slug: string; onApplied: (r: AutoAssignResult) => void }) {
  const [reviews, setReviews] = useState(3);
  const [cap, setCap] = useState("");
  const [batch, setBatch] = useState("");
  const [preview, setPreview] = useState<AutoAssignResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const body = () => ({
    reviewsPerProject: reviews,
    maxPerJudge: cap ? Number(cap) : null,
    batch: batch.trim() || undefined,
  });

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    const res = await autoAssignClient(slug, { ...body(), dryRun });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error ?? "Could not plan assignments.");
      return;
    }
    if (dryRun) setPreview(res.data);
    else {
      setPreview(null);
      onApplied(res.data);
    }
  }

  return (
    <Panel title="Assign automatically" description="Tops every project up to N reviews from judges who may see its track.">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="auto-n" className="field-label">
            Reviews per project
          </label>
          <input
            id="auto-n"
            type="number"
            min={1}
            max={10}
            value={reviews}
            onChange={(e) => {
              setReviews(Math.min(10, Math.max(1, Number(e.target.value) || 1)));
              setPreview(null);
            }}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="auto-cap" className="field-label">
            Max per judge
          </label>
          <input
            id="auto-cap"
            type="number"
            min={1}
            value={cap}
            placeholder="No limit"
            onChange={(e) => {
              setCap(e.target.value);
              setPreview(null);
            }}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="auto-batch" className="field-label">
            Batch label
          </label>
          <input id="auto-batch" value={batch} onChange={(e) => setBatch(e.target.value)} className="field" placeholder="Round 1" />
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        Fills the scarcest tracks first and hands each project to the least-loaded eligible judges. Judges never get their
        own team. Existing assignments count, so running it again only fills gaps.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void run(true)}>
          Preview
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={() => void run(false)}>
          {busy ? "Working…" : "Assign now"}
        </Button>
      </div>
      {error ? (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      {preview ? (
        <div className="mt-5 space-y-3 rounded-xl border border-dashed border-line bg-zinc-50 p-4 text-sm">
          <p>
            <span className="font-semibold text-ink">{preview.planned}</span> new assignments.{" "}
            {preview.shortfalls.length ? (
              <span className="text-amber-700">{preview.shortfalls.length} projects can&apos;t reach {reviews} reviews.</span>
            ) : (
              <span className="text-emerald-700">Every project reaches {reviews} reviews.</span>
            )}
          </p>
          <div>
            <Label>Load after assigning</Label>
            <ul className="mt-2 grid max-h-40 grid-cols-2 gap-x-4 gap-y-1 overflow-auto font-mono text-xs">
              {preview.load.map((row) => (
                <li key={row.judgeId} className="flex justify-between gap-2">
                  <span className="truncate text-zinc-600">{row.name}</span>
                  <span className="text-ink">{row.assigned}</span>
                </li>
              ))}
            </ul>
          </div>
          {preview.shortfalls.length ? (
            <div>
              <Label>Short of reviewers</Label>
              <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-xs text-zinc-600">
                {preview.shortfalls.map((s) => (
                  <li key={s.projectId}>
                    {s.title} <span className="text-zinc-400">({s.track})</span> — {s.have}/{s.wanted}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

function BatchAssign({
  slug,
  judges,
  projects,
  onDone,
}: {
  slug: string;
  judges: OrganizerJudgeProgress[];
  projects: AssignmentCoverage[];
  onDone: (text: string, tone: "success" | "warning") => void;
}) {
  const [judgeIds, setJudgeIds] = useState<string[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [batch, setBatch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function submit() {
    setError(null);
    const res = await assignBatchClient(slug, { judgeIds, projectIds, batch: batch.trim() || undefined });
    if (res.error || !res.data) {
      setError(res.error ?? "Could not assign.");
      return;
    }
    const { created, skipped } = res.data;
    const reasons = Array.from(new Set(skipped.map((s) => s.reason)));
    onDone(
      `Assigned ${created} pairs.${skipped.length ? ` Skipped ${skipped.length}: ${reasons.join("; ")}.` : ""}`,
      skipped.length ? "warning" : "success",
    );
    setProjectIds([]);
  }

  return (
    <Panel title="Assign a batch" description="Every selected judge reviews every selected project. Pairs that break a rule are skipped.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Picker
          label={`Judges · ${judgeIds.length}`}
          items={judges.map((j) => ({ id: j.id, label: j.name, hint: j.tracks?.join(", ") || "All tracks" }))}
          selected={judgeIds}
          onToggle={(id) => setJudgeIds((v) => toggle(v, id))}
        />
        <Picker
          label={`Projects · ${projectIds.length}`}
          items={projects.map((p) => ({ id: p.projectId, label: p.title, hint: `${p.track ?? ""} · ${p.assigned} judges` }))}
          selected={projectIds}
          onToggle={(id) => setProjectIds((v) => toggle(v, id))}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="batch-label" className="field-label">
            Batch label
          </label>
          <input id="batch-label" value={batch} onChange={(e) => setBatch(e.target.value)} className="field" placeholder="Finalists" />
        </div>
        <Button type="button" size="sm" disabled={!judgeIds.length || !projectIds.length} onClick={() => void submit()}>
          Assign {judgeIds.length * projectIds.length || ""} pairs
        </Button>
      </div>
      {error ? (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
    </Panel>
  );
}

function Picker({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: Array<{ id: string; label: string; hint: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="field-label">{label}</legend>
      <div className="max-h-56 overflow-auto rounded-lg border border-line">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-start gap-2.5 border-b border-line px-3 py-2 text-sm last:border-b-0 hover:bg-zinc-50"
          >
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => onToggle(item.id)}
              className="mt-0.5 h-4 w-4 accent-ink"
            />
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{item.label}</span>
              <span className="block truncate text-xs text-zinc-500">{item.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
