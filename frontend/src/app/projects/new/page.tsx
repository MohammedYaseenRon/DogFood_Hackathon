import { SubmitForm } from "@/components/SubmitForm";
import { ParticipantGate } from "@/components/RoleGuards";
import { fetchEvent } from "@/lib/api";

export default async function NewProjectPage() {
  const event = await fetchEvent();

  return (
    <ParticipantGate
      eventHref={event?.slug ? `/events/${event.slug}` : "/events"}
    >
      <SubmitForm event={event} />
    </ParticipantGate>
  );
}
