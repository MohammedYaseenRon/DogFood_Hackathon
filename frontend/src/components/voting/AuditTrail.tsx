"use client";

import { useEffect, useMemo, useState } from "react";
import { exportUrl, fetchEventAuditClient, type AuditRow } from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeaderBand } from "@/components/ui/PageShell";
import { Spinner } from "@/components/judging/shared";

const CATEGORY_TONE: Record<string, string> = {
  voting: "bg-signal-300",
  judging: "bg-brand-500",
  comments: "bg-emerald-500",
  submissions: "bg-ink",
  teams: "bg-zinc-400",
  setup: "bg-zinc-600",
  other: "bg-zinc-300",
};

export function AuditTrail({ slug }: { slug: string }) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchEventAuditClient(slug, category || undefined).then((res) => {
      if (!active) return;
      if (res.data) {
        setRows(res.data.entries);
        setCategories(res.data.categories);
      } else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, [slug, category]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows || !q) return rows ?? [];
    return rows.filter((r) => `${r.label} ${r.actor} ${r.summary} ${r.resource}`.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <main className="pb-24">
      <PageHeaderBand
        eyebrow="Organizer / audit"
        title="Audit trail"
        mark="trail"
        description="Everything that happened in this event: who did it, when, and what changed. No database client needed."
        action={
          <>
            <ButtonLink href={exportUrl(slug, "audit")} variant="secondary" size="sm">
              Download CSV
            </ButtonLink>
            <ButtonLink href={`/organizer/events/${slug}`} variant="ghost" size="sm">
              Event overview
            </ButtonLink>
          </>
        }
      />
      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {["", ...categories].map((key) => (
            <button
              key={key || "all"}
              type="button"
              aria-pressed={category === key}
              onClick={() => {
                setRows(null);
                setCategory(key);
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold capitalize transition ${
                category === key ? "border-ink bg-ink text-white" : "border-line bg-white text-zinc-600 hover:border-zinc-400"
              }`}
            >
              {key || "All"}
            </button>
          ))}
          <input
            type="search"
            aria-label="Search the audit trail"
            placeholder="Search people, actions, details"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="field ml-auto w-full py-2 sm:w-72"
          />
        </div>

        {error ? <p className="text-red-600">{error}</p> : null}
        {!rows && !error ? <Spinner /> : null}
        {rows && visible.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white py-12 text-center text-sm text-zinc-500">Nothing matches.</p>
        ) : null}
        {visible.length ? (
          <ol className="relative space-y-0 overflow-hidden rounded-2xl border border-line bg-white">
            {visible.map((row) => (
              <li key={row.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 border-b border-line px-5 py-3.5 last:border-b-0 sm:grid-cols-[150px_auto_minmax(0,1fr)]">
                <time dateTime={row.at} title={formatDateTime(row.at)} className="hidden font-mono text-xs text-zinc-500 sm:block">
                  {formatDateTime(row.at)}
                </time>
                <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 rounded-[3px] ${CATEGORY_TONE[row.category] ?? "bg-zinc-300"}`} />
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold text-ink">{row.label}</span>
                    <span className="text-zinc-500"> · {row.actor}</span>
                    {row.actorRole ? <span className="ml-1 font-mono text-[10px] text-zinc-400 uppercase">{row.actorRole}</span> : null}
                  </p>
                  {row.summary ? <p className="mt-0.5 truncate text-sm text-zinc-600">{row.summary}</p> : null}
                  <p className="mt-0.5 font-mono text-[11px] text-zinc-400 sm:hidden">{relativeTime(row.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </main>
  );
}
