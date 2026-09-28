import { CreateTeamForm } from "@/components/CreateTeamForm";
import { ParticipantGate } from "@/components/RoleGuards";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/ui/PageShell";
import { fetchEvents } from "@/lib/server-api";

type Props = { searchParams: Promise<{ event?: string }> };

export default async function NewTeamPage({ searchParams }: Props) {
  const { event } = await searchParams;
  const events = (await fetchEvents()).filter((e) => e.state.teamFormationOpen);

  return (
    <ParticipantGate allowVisitors>
      <PageShell
        tone="amber"
        eyebrow="Team formation"
        title="Create a team"
        description="Start a team, then invite teammates with a secure link."
        maxWidth="max-w-3xl"
      >
        <Card variant="elevated">
          <CreateTeamForm events={events} defaultEvent={event} />
        </Card>
        <div className="mt-4">
          <ButtonLink href="/participant" variant="ghost">
            ← Back to dashboard
          </ButtonLink>
        </div>
      </PageShell>
    </ParticipantGate>
  );
}
