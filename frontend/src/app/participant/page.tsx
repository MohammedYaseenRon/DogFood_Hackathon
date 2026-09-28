import { ParticipantDashboard } from "@/components/ParticipantDashboard";
import { ButtonLink } from "@/components/ui/Button";
import { PageShell } from "@/components/ui/PageShell";

export default function ParticipantPage() {
  return (
    <PageShell
      eyebrow="Participant / hub"
      title="Your hackathons"
      mark="hackathons"
      description="Where each of your events stands, and the one thing to do next."
      maxWidth="max-w-5xl"
      action={
        <ButtonLink href="/events" variant="secondary">
          Browse events
        </ButtonLink>
      }
    >
      <ParticipantDashboard />
    </PageShell>
  );
}
