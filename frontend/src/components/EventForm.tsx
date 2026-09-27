"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  createEventClient,
  updateEventClient,
  type EventInfo,
} from "@/lib/api";

type TrackRow = { id?: string; name: string };
type PrizeRow = {
  name: string;
  amount: string;
  rank: number;
  trackIndex: number | "";
};

function toLocalDatetimeValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultPrizes(): PrizeRow[] {
  return [
    { name: "Grand prize", amount: "$2,500", rank: 1, trackIndex: "" },
    { name: "Best in track", amount: "$500", rank: 2, trackIndex: 0 },
  ];
}

export function EventForm({
  mode,
  initialEvent,
}: {
  mode: "create" | "edit";
  initialEvent?: EventInfo | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialEvent?.name ?? "");
  const [submissionsClose, setSubmissionsClose] = useState(
    initialEvent ? toLocalDatetimeValue(initialEvent.submissionsClose) : "",
  );
  const [tracks, setTracks] = useState<TrackRow[]>(
    initialEvent?.tracks.map((t) => ({ id: t.id, name: t.name })) ?? [
      { name: "Developer tools" },
      { name: "Accessibility" },
      { name: "Security" },
    ],
  );
  const [prizes, setPrizes] = useState<PrizeRow[]>(() => {
    if (initialEvent?.prizes?.length) {
      return initialEvent.prizes.map((p) => ({
        name: p.name,
        amount: p.amount,
        rank: p.rank,
        trackIndex: (() => {
          if (p.trackId == null) return "" as const;
          const idx = initialEvent.tracks.findIndex((t) => t.id === p.trackId);
          return idx >= 0 ? idx : ("" as const);
        })(),
      }));
    }
    return defaultPrizes();
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const trackOptions = useMemo(
    () => tracks.map((t, i) => ({ index: i, name: t.name || `Track ${i + 1}` })),
    [tracks],
  );

  function addTrack() {
    setTracks((prev) => [...prev, { name: "" }]);
  }

  function removeTrack(index: number) {
    setTracks((prev) => prev.filter((_, i) => i !== index));
    setPrizes((prev) =>
      prev.map((p) => {
        if (p.trackIndex === "") return p;
        const ti = p.trackIndex as number;
        if (ti === index) return { ...p, trackIndex: "" };
        if (ti > index) return { ...p, trackIndex: ti - 1 };
        return p;
      }),
    );
  }

  function addPrize() {
    setPrizes((prev) => [
      ...prev,
      { name: "", amount: "", rank: prev.length + 1, trackIndex: "" },
    ]);
  }

  function removePrize(index: number) {
    setPrizes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trackList = tracks.map((t) => ({
      id: t.id,
      name: t.name.trim(),
    })).filter((t) => t.name);

    if (trackList.length === 0) {
      setError("Add at least one track.");
      return;
    }

    const prizeList = prizes
      .filter((p) => p.name.trim() && p.amount.trim())
      .map((p) => ({
        name: p.name.trim(),
        amount: p.amount.trim(),
        rank: p.rank,
        track_index:
          p.trackIndex === "" ? undefined : (p.trackIndex as number),
      }));

    const payload = {
      name: name.trim(),
      submissions_close: new Date(submissionsClose).toISOString(),
      tracks: trackList,
      prizes: prizeList,
    };

    setLoading(true);
    const result =
      mode === "edit"
        ? await updateEventClient(payload)
        : await createEventClient(payload);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.event) {
      router.push("/event");
      router.refresh();
    }
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-[#3770FF] focus:outline-none focus:ring-2 focus:ring-blue-100";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-zinc-900">
          Event details
        </h2>
        <div>
          <label className="mb-2 block text-sm font-semibold text-zinc-700">
            Event name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClass}
            placeholder="Dogfood 2026"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-zinc-700">
            Submissions close
          </label>
          <input
            type="datetime-local"
            value={submissionsClose}
            onChange={(e) => setSubmissionsClose(e.target.value)}
            required
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-zinc-400">
            Participants cannot submit or edit projects after this date.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-zinc-900">
            Tracks
          </h2>
          <Button type="button" variant="secondary" size="sm" onClick={addTrack}>
            + Add track
          </Button>
        </div>
        <div className="space-y-3">
          {tracks.map((track, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={track.name}
                onChange={(e) =>
                  setTracks((prev) =>
                    prev.map((t, i) =>
                      i === index ? { ...t, name: e.target.value } : t,
                    ),
                  )
                }
                required
                className={inputClass}
                placeholder={`Track ${index + 1}`}
              />
              {tracks.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeTrack(index)}
                  className="shrink-0 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-500 hover:border-red-200 hover:text-red-600"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-zinc-900">
            Prizes
          </h2>
          <Button type="button" variant="secondary" size="sm" onClick={addPrize}>
            + Add prize
          </Button>
        </div>
        <div className="space-y-4">
          {prizes.map((prize, index) => (
            <div
              key={index}
              className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">
                    Prize name
                  </label>
                  <input
                    value={prize.name}
                    onChange={(e) =>
                      setPrizes((prev) =>
                        prev.map((p, i) =>
                          i === index ? { ...p, name: e.target.value } : p,
                        ),
                      )
                    }
                    className={inputClass}
                    placeholder="Grand prize"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">
                    Amount
                  </label>
                  <input
                    value={prize.amount}
                    onChange={(e) =>
                      setPrizes((prev) =>
                        prev.map((p, i) =>
                          i === index ? { ...p, amount: e.target.value } : p,
                        ),
                      )
                    }
                    className={inputClass}
                    placeholder="$2,500"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">
                    Rank
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={prize.rank}
                    onChange={(e) =>
                      setPrizes((prev) =>
                        prev.map((p, i) =>
                          i === index
                            ? { ...p, rank: Number(e.target.value) }
                            : p,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">
                    Track (optional)
                  </label>
                  <select
                    value={prize.trackIndex === "" ? "" : String(prize.trackIndex)}
                    onChange={(e) =>
                      setPrizes((prev) =>
                        prev.map((p, i) =>
                          i === index
                            ? {
                                ...p,
                                trackIndex:
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                              }
                            : p,
                        ),
                      )
                    }
                    className={inputClass}
                  >
                    <option value="">Overall (all tracks)</option>
                    {trackOptions.map((t) => (
                      <option key={t.index} value={t.index}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {prizes.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removePrize(index)}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Remove prize
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <Button type="submit" disabled={loading} size="lg">
        {loading
          ? mode === "edit"
            ? "Saving..."
            : "Creating..."
          : mode === "edit"
            ? "Save event"
            : "Create event"}
      </Button>

      {error ? <Alert tone="error">{error}</Alert> : null}
    </form>
  );
}
