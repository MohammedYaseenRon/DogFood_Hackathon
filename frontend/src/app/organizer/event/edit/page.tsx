import { EventForm } from "@/components/EventForm";
import { OrganizerGate } from "@/components/RoleGuards";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageShell } from "@/components/ui/PageShell";
import { fetchEvent } from "@/lib/api";

export default async function EditEventPage() {
  const event = await fetchEvent();

  if (!event) {
    return (
      <PageShell tone="violet" title="Manage event" description="No event configured yet.">
        <OrganizerGate>
          <EmptyState
            title="No event yet"
            description="Create a hackathon event before editing configuration."
            action={
              <ButtonLink href="/organizer/event/new" variant="primary">
                Create event
              </ButtonLink>
            }
          />
        </OrganizerGate>
      </PageShell>
    );
  }

  const closed = !event.state?.submissionsOpen;

  return (
    <PageShell
      tone="violet"
      eyebrow="Event settings"
      title="Manage event"
      description={`Update the deadline, tracks, and prizes for ${event.name}.`}
      action={
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/organizer/dashboard" variant="secondary" size="sm">
            Dashboard
          </ButtonLink>
          <ButtonLink href="/event" variant="secondary" size="sm">
            Public page
          </ButtonLink>
        </div>
      }
    >
      <OrganizerGate>
        <Card variant="elevated">
          <EventForm mode="edit" initialEvent={event} submissionsOpen={!closed} />
        </Card>
      </OrganizerGate>
    </PageShell>
  );
}
