"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Option = { id: string; name: string; count: number };

const SORTS = [
  { value: "title", label: "A → Z" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

export function GalleryFilters({
  events,
  tracks,
  tags,
}: {
  events: Array<{ slug: string; name: string }>;
  tracks: Option[];
  tags: Array<{ name: string; count: number }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = {
    q: searchParams.get("q") ?? "",
    event: searchParams.get("event") ?? "",
    track: searchParams.get("track") ?? "",
    tag: searchParams.get("tag") ?? "",
    sort: searchParams.get("sort") ?? "title",
  };
  // The page remounts this component when `q` changes, so initial state stays in sync.
  const [q, setQ] = useState(current.q);

  function apply(next: Partial<typeof current>) {
    const merged = { ...current, ...next };
    // Track ids belong to one event; drop the track when switching events.
    if (next.event !== undefined && next.event !== current.event) merged.track = "";
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value && !(key === "sort" && value === "title")) params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `/projects?${query}` : "/projects");
  }

  const activeCount = [current.q, current.event, current.track, current.tag].filter(Boolean).length;
  const selectClass =
    "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

  return (
    <div className="sticky top-[57px] z-40 border-b border-zinc-200/80 bg-white/90 py-4 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl space-y-3 px-6">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ q: q.trim() });
          }}
          className="flex items-center gap-3"
        >
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              aria-label="Search projects"
              placeholder="Search by name, description, team, track or tech…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white py-3 pl-11 pr-4 text-sm text-zinc-800 shadow-sm transition placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800">
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {events.length > 1 ? (
            <select aria-label="Event" value={current.event} onChange={(e) => apply({ event: e.target.value })} className={selectClass}>
              <option value="">All events</option>
              {events.map((event) => (
                <option key={event.slug} value={event.slug}>
                  {event.name}
                </option>
              ))}
            </select>
          ) : null}
          <select aria-label="Track" value={current.track} onChange={(e) => apply({ track: e.target.value })} className={selectClass}>
            <option value="">All tracks</option>
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name} ({track.count})
              </option>
            ))}
          </select>
          <select aria-label="Sort" value={current.sort} onChange={(e) => apply({ sort: e.target.value })} className={selectClass}>
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                Sort: {sort.label}
              </option>
            ))}
          </select>
          {activeCount ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                router.push("/projects");
              }}
              className="ml-auto text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Clear filters ({activeCount})
            </button>
          ) : null}
        </div>

        {tags.length ? (
          <div className="flex flex-wrap gap-2" aria-label="Filter by technology">
            {tags.slice(0, 16).map((tag) => {
              const active = current.tag.toLowerCase() === tag.name.toLowerCase();
              return (
                <button
                  key={tag.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => apply({ tag: active ? "" : tag.name })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {tag.name} <span className="opacity-60">{tag.count}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
