import { EventForm } from "@/components/EventForm";
import { OrganizerGate } from "@/components/RoleGuards";
import { FormPageLayout } from "@/components/ui/FormPageLayout";
import { fetchEvent } from "@/lib/api";
import { redirect } from "next/navigation";

export default async function NewEventPage() {
  const event = await fetchEvent();
  if (event) {
    redirect("/organizer/event/edit");
  }

  return (
    <OrganizerGate>
      <FormPageLayout
        eyebrow="Event setup"
        title="Create hackathon event"
        description="Configure your event name, submission deadline, tracks, and prize pool."
        fullWidth
      >
        <EventForm mode="create" submissionsOpen />
      </FormPageLayout>
    </OrganizerGate>
  );
}
