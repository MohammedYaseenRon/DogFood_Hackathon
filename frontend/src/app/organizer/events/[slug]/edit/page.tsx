import { EventForm } from "@/components/EventForm";
import { OrganizerGate } from "@/components/RoleGuards";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormPageLayout } from "@/components/ui/FormPageLayout";
import { fetchEventBySlug } from "@/lib/server-api";

type Props = { params: Promise<{ slug: string }> };

export default async function EditEventPage({ params }: Props) {
  const { slug } = await params;
  const event = await fetchEventBySlug(slug);

  return (
    <OrganizerGate>
      {event ? (
        <FormPageLayout
          eyebrow="Event settings"
          title={`Edit ${event.name}`}
          description="Changes apply immediately. Moving the deadline reopens or closes submissions right away."
          fullWidth
        >
          <EventForm mode="edit" initialEvent={event} />
        </FormPageLayout>
      ) : (
        <FormPageLayout eyebrow="Event settings" title="Event not found">
          <EmptyState
            title="No event at this address"
            description="It may have been renamed. Pick it from the organizer dashboard."
            action={<ButtonLink href="/organizer/dashboard">Organizer dashboard</ButtonLink>}
          />
        </FormPageLayout>
      )}
    </OrganizerGate>
  );
}
