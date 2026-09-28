import { SubmitForm } from "@/components/SubmitForm";
import { ParticipantGate } from "@/components/RoleGuards";

type Props = { searchParams: Promise<{ event?: string }> };

export default async function NewProjectPage({ searchParams }: Props) {
  const { event } = await searchParams;

  return (
    <ParticipantGate eventHref={event ? `/events/${event}` : "/events"}>
      <SubmitForm eventSlug={event} />
    </ParticipantGate>
  );
}
