"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
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

function formatPreviewDate(value: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function defaultPrizes(): PrizeRow[] {
  return [
    { name: "Grand prize", amount: "$2,500", rank: 1, trackIndex: "" },
    { name: "Best in track", amount: "$500", rank: 2, trackIndex: 0 },
  ];
}

const inputClass =
  "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/10";

export function EventForm({
  mode,
  initialEvent,
  submissionsOpen = true,
}: {
  mode: "create" | "edit";
  initialEvent?: EventInfo | null;
  submissionsOpen?: boolean;
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

  const filledTracks = tracks.filter((track) => track.name.trim()).length;
  const filledPrizes = prizes.filter(
    (prize) => prize.name.trim() && prize.amount.trim(),
  ).length;

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

    const trackList = tracks
      .map((t) => ({
        id: t.id,
        name: t.name.trim(),
      }))
      .filter((t) => t.name);

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
        track_index: p.trackIndex === "" ? undefined : (p.trackIndex as number),
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

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700">
                1
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-zinc-950">
                  Event details
                </h2>
                <p className="text-sm text-zinc-500">
                  Name and submission deadline for your hackathon.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-5 p-6">
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
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                Participants cannot submit or edit projects after this date.
              </p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-zinc-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-sm font-bold text-cyan-700">
                2
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-zinc-950">
                  Tracks
                </h2>
                <p className="text-sm text-zinc-500">
                  Categories participants choose when submitting.
                </p>
              </div>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addTrack}>
              + Add track
            </Button>
          </div>
          <div className="space-y-3 p-6">
            {tracks.map((track, index) => (
              <div
                key={`${track.id ?? "new"}-${index}`}
                className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/60 p-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-zinc-500 shadow-sm">
                  {index + 1}
                </span>
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
                    className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-zinc-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-sm font-bold text-amber-700">
                3
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-zinc-950">
                  Prizes
                </h2>
                <p className="text-sm text-zinc-500">
                  Optional awards shown on the public event page.
                </p>
              </div>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addPrize}>
              + Add prize
            </Button>
          </div>
          <div className="space-y-4 p-6">
            {prizes.map((prize, index) => (
              <div
                key={index}
                className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-semibold tracking-[0.16em] text-zinc-400 uppercase">
                    Prize {index + 1}
                  </p>
                  {prizes.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removePrize(index)}
                      className="text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-zinc-500">
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
                    <label className="mb-1.5 block text-xs font-semibold text-zinc-500">
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
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-zinc-500">
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
                    <label className="mb-1.5 block text-xs font-semibold text-zinc-500">
                      Track (optional)
                    </label>
                    <select
                      value={
                        prize.trackIndex === "" ? "" : String(prize.trackIndex)
                      }
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
              </div>
            ))}
          </div>
        </section>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="flex flex-wrap items-center gap-3 lg:hidden">
          <Button type="submit" disabled={loading} size="lg">
            {loading
              ? mode === "edit"
                ? "Saving..."
                : "Creating..."
              : mode === "edit"
                ? "Save event"
                : "Create event"}
          </Button>
          <ButtonLink href="/organizer/dashboard" variant="secondary" size="lg">
            Cancel
          </ButtonLink>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.16em] text-zinc-400 uppercase">
            Preview
          </p>
          <h3 className="font-display mt-2 text-xl font-bold text-zinc-950">
            {name.trim() || "Untitled event"}
          </h3>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-zinc-500">Deadline</dt>
              <dd className="text-right font-semibold text-zinc-900">
                {formatPreviewDate(submissionsClose)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-zinc-500">Submissions</dt>
              <dd className="font-semibold">
                <span
                  className={
                    submissionsOpen
                      ? "text-emerald-600"
                      : "text-amber-600"
                  }
                >
                  {submissionsOpen ? "Open" : "Closed"}
                </span>
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-zinc-500">Tracks</dt>
              <dd className="font-semibold text-zinc-900">{filledTracks}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-zinc-500">Prizes</dt>
              <dd className="font-semibold text-zinc-900">{filledPrizes}</dd>
            </div>
          </dl>
        </div>

        <div className="hidden rounded-[24px] border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm lg:block">
          <p className="text-sm text-zinc-400">
            {mode === "edit"
              ? "Save changes to update the live event configuration."
              : "Create the event to open submissions and gallery setup."}
          </p>
          <Button type="submit" disabled={loading} className="mt-5 w-full">
            {loading
              ? mode === "edit"
                ? "Saving..."
                : "Creating..."
              : mode === "edit"
                ? "Save event"
                : "Create event"}
          </Button>
          <ButtonLink
            href="/organizer/dashboard"
            variant="ghost"
            className="mt-2 w-full text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            Cancel
          </ButtonLink>
        </div>
      </aside>
    </form>
  );
}
