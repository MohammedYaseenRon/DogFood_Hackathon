"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { createEventClient } from "@/lib/api";

export function EventSetupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submissionsClose, setSubmissionsClose] = useState("");
  const [tracks, setTracks] = useState("Developer tools\nAccessibility\nSecurity");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trackList = tracks
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((trackName) => ({ name: trackName }));

    const isoClose = new Date(submissionsClose).toISOString();

    const { event, error: createError } = await createEventClient({
      name: name.trim(),
      submissions_close: isoClose,
      tracks: trackList,
      prizes: [
        { name: "Grand prize", amount: "$2,500", rank: 1 },
        { name: "Best in track", amount: "$500", rank: 2, track_index: 0 },
      ],
    });

    setLoading(false);

    if (createError) {
      setError(createError);
      return;
    }

    if (event) {
      router.push("/event");
      router.refresh();
    }
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Alert tone="info">
        Organizers and admins can create the hackathon event with tracks and
        default prizes. Only one event is supported per portal instance.
      </Alert>

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
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-zinc-700">
          Tracks (one per line)
        </label>
        <textarea
          value={tracks}
          onChange={(e) => setTracks(e.target.value)}
          required
          rows={5}
          className={inputClass}
        />
      </div>

      <Button type="submit" disabled={loading} size="lg">
        {loading ? "Creating event..." : "Create event"}
      </Button>

      {error ? <Alert tone="error">{error}</Alert> : null}
    </form>
  );
}
