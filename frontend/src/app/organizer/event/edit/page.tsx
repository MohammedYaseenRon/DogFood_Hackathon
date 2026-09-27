import { EventForm } from "@/components/EventForm";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchEvent } from "@/lib/api";

export default async function EditEventPage() {
  const event = await fetchEvent();

  if (!event) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
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

  return (
    <main>
      <PageHeader
        variant="hero"
        title="Manage event"
        description="Update submission deadline, tracks, and prizes for your hackathon."
        action={
          <ButtonLink href="/event" variant="white">
            View public page
          </ButtonLink>
        }
      />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Card variant="elevated">
          <EventForm mode="edit" initialEvent={event} />
        </Card>
      </div>
    </main>
  );
}
