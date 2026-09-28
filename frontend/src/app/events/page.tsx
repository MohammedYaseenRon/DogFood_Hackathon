import { EventCard } from "@/components/EventCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageShell } from "@/components/ui/PageShell";
import { fetchEvents } from "@/lib/server-api";

export default async function EventsPage() {
  const events = await fetchEvents();
  const live = events.filter((e) => e.state.registrationOpen || e.state.submissionsOpen);
  const past = events.filter((e) => !live.includes(e));

  return (
    <PageShell
      eyebrow="Events"
      title="Pick your next deadline"
      mark="deadline"
      description="Register, form a team, and ship before the clock runs out. Past events stay here with their galleries."
      action={
        <ButtonLink href="/projects" variant="secondary">
          Browse projects
        </ButtonLink>
      }
    >
      {events.length === 0 ? (
        <EmptyState
          title="No published events"
          description="Organizers can create one from the organizer dashboard."
          action={<ButtonLink href="/organizer/event/new">Create an event</ButtonLink>}
        />
      ) : (
        <div className="space-y-14">
          {live.length > 0 ? (
            <section aria-labelledby="live-events">
              <h2 id="live-events" className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
                Open now · {live.length}
              </h2>
              <ul className="mt-4 grid gap-5 lg:grid-cols-2">
                {live.map((event) => (
                  <li key={event.id}>
                    <EventCard event={event} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {past.length > 0 ? (
            <section aria-labelledby="past-events">
              <h2 id="past-events" className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
                Closed · {past.length}
              </h2>
              <ul className="mt-4 grid gap-5 lg:grid-cols-2">
                {past.map((event) => (
                  <li key={event.id}>
                    <EventCard event={event} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
