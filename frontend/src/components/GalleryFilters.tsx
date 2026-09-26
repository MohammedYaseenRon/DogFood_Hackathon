"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Track = { id: string; name: string };

export function GalleryFilters({ tracks }: { tracks: Track[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const track = searchParams.get("track") ?? "";

  function apply(nextQ: string, nextTrack: string) {
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextTrack) params.set("track", nextTrack);
    router.push(`/projects?${params.toString()}`);
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
      <input
        type="search"
        placeholder="Search by title or summary..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply(q, track)}
        className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      <select
        value={track}
        onChange={(e) => apply(q, e.target.value)}
        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
      >
        <option value="">All tracks</option>
        {tracks.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => apply(q, track)}
        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Search
      </button>
    </div>
  );
}
