import { EventCard } from "@/components/EventCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageShell } from "@/components/ui/PageShell";
import { fetchEvents } from "@/lib/api";

export default async function EventsPage() {
  const events = await fetchEvents();

  return (
    <PageShell
      tone="blue"
      eyebrow="Events"
      title="Hackathons"
      description="Browse published events, explore tracks and prizes, and register to participate."
    >
      {events.length === 0 ? (
        <EmptyState
          title="No published events"
          description="Check back soon or sign in as an organizer to create one."
        />
      ) : (
        <ul className="grid gap-6 lg:grid-cols-2">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
