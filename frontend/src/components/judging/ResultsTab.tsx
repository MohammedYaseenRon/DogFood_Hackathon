"use client";

import { useEffect, useMemo, useState } from "react";
import { EXPORT_KINDS, exportUrl, fetchEventResultsClient, type EventResults } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Label, Panel, Spinner } from "@/components/judging/shared";

export function ResultsTab({ slug }: { slug: string }) {
  const [data, setData] = useState<EventResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let active = true;
    fetchEventResultsClient(slug).then((res) => {
      if (!active) return;
      if (res.data) setData(res.data);
      else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  const tracks = useMemo(
    () => Array.from(new Set((data?.projects ?? []).map((p) => p.track).filter(Boolean))) as string[],
    [data],
  );

  if (error) return <p className="py-10 text-center text-sm text-red-600">{error}</p>;
  if (!data) return <Spinner />;

  const rows = data.projects.filter((p) => !track || p.track === track);
  const maxLeniency = Math.max(0.01, ...data.judges.map((j) => Math.abs(j.leniency)));

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white">
        <div aria-hidden className="graph-paper-dark absolute inset-0" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">Normalization</p>
            <p className="font-display mt-3 text-xl font-semibold">
              <span className="hl hl-solid capitalize">{data.method.name}</span>
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">{data.method.summary}</p>
          </div>
          <dl className="flex gap-6 font-mono text-sm">
            <div>
              <dt className="text-[11px] tracking-[0.14em] text-white/50 uppercase">Event mean</dt>
              <dd className="font-display mt-1 text-2xl text-signal-300">{data.eventMean.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-[0.14em] text-white/50 uppercase">Spread</dt>
              <dd className="font-display mt-1 text-2xl">{data.eventSpread.toFixed(2)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel
          title="Standings"
          description={`Ranked by normalized score. Fewer than ${data.method.lowConfidenceBelow} reviews is flagged low confidence.`}
          action={
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} className="h-4 w-4 accent-ink" />
                Raw columns
              </label>
              <select aria-label="Filter by track" value={track} onChange={(e) => setTrack(e.target.value)} className="field w-auto py-2">
                <option value="">All tracks</option>
                {tracks.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          }
        >
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left font-mono text-[11px] tracking-[0.12em] text-zinc-500 uppercase">
                <tr>
                  <th className="px-5 py-2.5 font-medium sm:pl-6">{track ? "Track" : "Rank"}</th>
                  <th className="px-3 py-2.5 font-medium">Project</th>
                  <th className="px-3 py-2.5 text-right font-medium">Reviews</th>
                  {showRaw ? <th className="px-3 py-2.5 text-right font-medium">Raw</th> : null}
                  {showRaw ? <th className="px-3 py-2.5 text-right font-medium">Raw rank</th> : null}
                  <th className="px-5 py-2.5 text-right font-medium sm:pr-6">Normalized</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rank = track ? row.trackRank : row.rank;
                  const moved = row.rank && row.rawRank ? row.rawRank - row.rank : 0;
                  return (
                    <tr key={row.projectId} className={`border-t border-line ${row.duplicateOf ? "opacity-55" : ""}`}>
                      <td className="px-5 py-3 font-display font-semibold text-ink tabular-nums sm:pl-6">
                        {rank ?? "—"}
                        {!track && moved ? (
                          <span className={`ml-1.5 font-mono text-[11px] ${moved > 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {moved > 0 ? `▲${moved}` : `▼${-moved}`}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-ink">{row.title}</p>
                        <p className="text-xs text-zinc-500">
                          {row.teamName} · {row.track}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {row.lowConfidence && !row.duplicateOf ? <Badge tone="warning">Low confidence</Badge> : null}
                          {row.duplicateOf ? <Badge>Duplicate of {row.duplicateOf} · not ranked</Badge> : null}
                          {row.disagreement != null && row.disagreement >= 0.75 ? <Badge tone="danger">Judges split</Badge> : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-zinc-600">{row.reviews}</td>
                      {showRaw ? <td className="px-3 py-3 text-right font-mono text-zinc-600">{row.rawMean?.toFixed(2) ?? "—"}</td> : null}
                      {showRaw ? <td className="px-3 py-3 text-right font-mono text-zinc-600">{row.rawRank ?? "—"}</td> : null}
                      <td className="px-5 py-3 text-right font-display text-base font-semibold text-ink tabular-nums sm:pr-6">
                        {row.normalized?.toFixed(2) ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Judge calibration" description="Leniency relative to the event average, after shrinkage.">
            <ul className="space-y-3">
              {data.judges.map((judge) => (
                <li key={judge.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-ink">
                      {judge.name}
                      {judge.flat ? <span className="ml-2 font-mono text-[10px] text-amber-700 uppercase">flat</span> : null}
                    </span>
                    <span className="font-mono text-xs text-zinc-500">
                      {judge.leniency > 0 ? "+" : ""}
                      {judge.leniency.toFixed(2)} · n={judge.reviews}
                    </span>
                  </div>
                  <div className="relative mt-1 h-1.5 rounded-full bg-zinc-100">
                    <span aria-hidden className="absolute top-[-2px] left-1/2 h-[10px] w-px bg-zinc-400" />
                    <span
                      aria-hidden
                      className={`absolute top-0 h-full rounded-full ${judge.leniency > 0 ? "bg-signal-400" : "bg-brand-500"}`}
                      style={{
                        left: judge.leniency > 0 ? "50%" : `${50 - (Math.abs(judge.leniency) / maxLeniency) * 50}%`,
                        width: `${(Math.abs(judge.leniency) / maxLeniency) * 50}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-zinc-500">
              <span className="font-semibold text-signal-600">Yellow</span> scores above average,{" "}
              <span className="font-semibold text-brand-600">blue</span> below.
            </p>
          </Panel>
          <ExportsPanel slug={slug} />
        </div>
      </div>
    </div>
  );
}

export function ExportsPanel({ slug }: { slug: string }) {
  return (
    <Panel title="Exports" description="CSV at every stage. Opens safely in spreadsheets.">
      <ul className="divide-y divide-line">
        {EXPORT_KINDS.map((item) => (
          <li key={item.kind}>
            <a
              href={exportUrl(slug, item.kind)}
              className="group flex items-center justify-between gap-3 py-2.5"
              download
            >
              <span>
                <span className="block text-sm font-semibold text-ink group-hover:underline">{item.label}</span>
                <span className="block text-xs text-zinc-500">{item.hint}</span>
              </span>
              <Label className="shrink-0 group-hover:text-ink">CSV ↓</Label>
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
