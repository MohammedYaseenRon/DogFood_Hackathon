import { EventForm } from "@/components/EventForm";
import { OrganizerGate } from "@/components/RoleGuards";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormPageLayout } from "@/components/ui/FormPageLayout";
import { fetchEvent } from "@/lib/api";

export default async function EditEventPage() {
  const event = await fetchEvent();

  if (!event) {
    return (
      <OrganizerGate>
        <FormPageLayout
          eyebrow="Event settings"
          title="Manage event"
          description="No event configured yet."
        >
          <EmptyState
            title="No event yet"
            description="Create a hackathon event before editing configuration."
            action={
              <ButtonLink href="/organizer/event/new" variant="primary">
                Create event
              </ButtonLink>
            }
          />
        </FormPageLayout>
      </OrganizerGate>
    );
  }

  const closed = !event.state?.submissionsOpen;

  return (
    <OrganizerGate>
      <FormPageLayout
        eyebrow="Event settings"
        title="Manage event"
        description={`Update the deadline, tracks, and prizes for ${event.name}.`}
        fullWidth
      >
        <EventForm mode="edit" initialEvent={event} submissionsOpen={!closed} />
      </FormPageLayout>
    </OrganizerGate>
  );
}
