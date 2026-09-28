import { EventForm } from "@/components/EventForm";
import { OrganizerGate } from "@/components/RoleGuards";
import { FormPageLayout } from "@/components/ui/FormPageLayout";

export default function NewEventPage() {
  return (
    <OrganizerGate>
      <FormPageLayout
        eyebrow="Event setup"
        title="Create a hackathon"
        description="Name, schedule, tracks, prizes and submission questions. Everything can be edited later."
        fullWidth
      >
        <EventForm mode="create" />
      </FormPageLayout>
    </OrganizerGate>
  );
}
