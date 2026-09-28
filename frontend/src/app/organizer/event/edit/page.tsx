import { EventForm } from "@/components/EventForm";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchEvent } from "@/lib/api";

export default async function EditEventPage() {
  const event = await fetchEvent();

  if (!event) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <EmptyState
          title="No event yet"
          description="Create a hackathon event before editing configuration."
          action={
            <ButtonLink href="/organizer/event/new" variant="primary">
              Create event
            </ButtonLink>
          }
        />
      </main>
    );
  }

  const closed = new Date() > new Date(event.submissionsClose);

  return (
    <main className="min-h-screen bg-zinc-50/80 pb-20">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">
              Event settings
            </p>
            <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-zinc-950">
              Manage event
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
              Update the deadline, tracks, and prizes for{" "}
              <span className="font-medium text-zinc-800">{event.name}</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/organizer/dashboard" variant="secondary" size="sm">
              Dashboard
            </ButtonLink>
            <ButtonLink href="/event" variant="secondary" size="sm">
              Public page
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <EventForm mode="edit" initialEvent={event} submissionsOpen={!closed} />
      </div>
    </main>
  );
}
