"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { createTeamClient, type EventInfo } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

const inputClass =
  "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10";

export function CreateTeamForm({
  events,
  defaultEvent,
}: {
  events: EventInfo[];
  defaultEvent?: string;
}) {
  const router = useRouter();
  const [eventSlug, setEventSlug] = useState(
    events.find((e) => e.slug === defaultEvent)?.slug ?? events[0]?.slug ?? "",
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = events.find((e) => e.slug === eventSlug);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!eventSlug) {
      setError("Choose an event.");
      return;
    }
    setLoading(true);
    const { team, error: createError } = await createTeamClient(
      name.trim(),
      eventSlug,
      description.trim() || undefined,
    );
    setLoading(false);

    if (createError || !team) {
      setError(createError ?? "Could not create the team.");
      return;
    }
    router.push(`/teams/${team.id}?created=1`);
    router.refresh();
  }

  if (events.length === 0) {
    return (
      <Alert tone="warning" title="No events are forming teams right now">
        Team formation opens with registration and closes at the submission deadline.
      </Alert>
    );
  }

  return (
    <form onSubmit={handleCreate} className="space-y-5">
      <div>
        <label htmlFor="team-event" className="mb-2 block text-sm font-semibold text-zinc-700">
          Event
        </label>
        <select
          id="team-event"
          value={eventSlug}
          onChange={(e) => setEventSlug(e.target.value)}
          className={inputClass}
        >
          {events.map((event) => (
            <option key={event.slug} value={event.slug}>
              {event.name}
            </option>
          ))}
        </select>
        {selected ? (
          <p className="mt-2 text-xs text-zinc-500">
            Teams of up to {selected.maxTeamSize} · submissions close{" "}
            {formatDateTime(selected.submissionsClose)}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="team-name" className="mb-2 block text-sm font-semibold text-zinc-700">
          Team name
        </label>
        <input
          id="team-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          className={inputClass}
          placeholder="The Hackathon Raptors"
        />
      </div>
      <div>
        <label htmlFor="team-desc" className="mb-2 block text-sm font-semibold text-zinc-700">
          What are you building? <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          id="team-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          className={inputClass}
          placeholder="A sentence to help teammates find you."
        />
      </div>
      <Button type="submit" disabled={loading || !name.trim()}>
        {loading ? "Creating..." : "Create team"}
      </Button>
      <p className="text-xs text-zinc-500">
        Creating a team registers you for the event. You&apos;ll get an invite link to share next.
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </form>
  );
}
