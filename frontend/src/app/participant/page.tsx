import { ParticipantDashboard } from "@/components/ParticipantDashboard";
import { Badge } from "@/components/ui/Badge";
import { PageShell } from "@/components/ui/PageShell";
import { fetchEvent } from "@/lib/api";

export default async function ParticipantPage() {
  const event = await fetchEvent();
  const submissionsOpen = event?.state?.submissionsOpen ?? false;

  return (
    <PageShell
      tone="amber"
      eyebrow="Participant"
      title="Participant hub"
      description="Join your team, submit your project, and track your hackathon journey."
      badge={
        <Badge tone={submissionsOpen ? "success" : "warning"}>
          {submissionsOpen ? "Submissions open" : "Submissions closed"}
        </Badge>
      }
    >
      <ParticipantDashboard submissionsOpen={submissionsOpen} />
    </PageShell>
  );
}
