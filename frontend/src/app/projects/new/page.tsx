import { SubmitForm } from "@/components/SubmitForm";
import { ParticipantGate } from "@/components/RoleGuards";
import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/ui/PageShell";
import { fetchEvent } from "@/lib/api";

export default async function NewProjectPage() {
  const event = await fetchEvent();

  return (
    <PageShell
      tone="violet"
      eyebrow="Submission"
      title="Submit a project"
      description="Participants only — create or edit your team's hackathon submission."
      maxWidth="max-w-3xl"
    >
      <ParticipantGate eventHref={event?.slug ? `/events/${event.slug}` : "/events"}>
        <Card variant="elevated">
          <SubmitForm event={event} />
        </Card>
      </ParticipantGate>
    </PageShell>
  );
}
