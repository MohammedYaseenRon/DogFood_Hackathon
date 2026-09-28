"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Track = { id: string; name: string };

export function GalleryFilters({ tracks }: { tracks: Track[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const track = searchParams.get("track") ?? "";
  const [filtersOpen, setFiltersOpen] = useState(Boolean(track));

  function apply(nextQ: string, nextTrack: string) {
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextTrack) params.set("track", nextTrack);
    const query = params.toString();
    router.push(query ? `/projects?${query}` : "/projects");
  }

  function clearFilters() {
    setQ("");
    setFiltersOpen(false);
    router.push("/projects");
  }

  const activeTrack = tracks.find((t) => t.id === track);

  return (
    <div className="sticky top-[57px] z-40 border-b border-zinc-200/80 bg-white/90 py-4 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              placeholder="Search projects by name, tech, team, or track..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply(q, track)}
              className="w-full rounded-lg border border-zinc-300 bg-white py-3 pl-11 pr-4 text-sm text-zinc-800 shadow-sm transition placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
              filtersOpen || track
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
            }`}
          >
            Filters
            <ChevronIcon open={filtersOpen} />
          </button>
        </div>

        {filtersOpen ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <label className="text-sm font-medium text-zinc-600">Track</label>
            <select
              value={track}
              onChange={(e) => apply(q, e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All tracks</option>
              {tracks.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            {(track || q) ? (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Clear all
              </button>
            ) : null}
          </div>
        ) : null}

        {activeTrack ? (
          <p className="mt-3 text-sm text-zinc-500">
            Showing projects in{" "}
            <span className="font-semibold text-zinc-700">
              {activeTrack.name}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
