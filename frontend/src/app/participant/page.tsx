import { ParticipantDashboard } from "@/components/ParticipantDashboard";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchEvent } from "@/lib/api";

export default async function ParticipantPage() {
  const event = await fetchEvent();
  const submissionsOpen = event
    ? new Date() <= new Date(event.submissionsClose)
    : false;

  return (
    <main className="min-h-screen bg-zinc-50/80 pb-16">
      <PageHeader
        variant="compact"
        eyebrow="Participant"
        title="Participant hub"
        description="Join your team, submit your project, and track your hackathon journey."
        badge={
          <Badge tone={submissionsOpen ? "success" : "warning"}>
            {submissionsOpen ? "Submissions open" : "Submissions closed"}
          </Badge>
        }
      />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <ParticipantDashboard submissionsOpen={submissionsOpen} />
      </div>
    </main>
  );
}
