import { CreateTeamForm } from "@/components/CreateTeamForm";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/ui/PageShell";

export default function NewTeamPage() {
  return (
    <PageShell
      tone="amber"
      eyebrow="Team formation"
      title="Create a team"
      description="Start a new team and invite teammates with a secure link."
      maxWidth="max-w-3xl"
    >
      <Card variant="elevated">
        <CreateTeamForm redirectToTeam />
      </Card>
      <div className="mt-4">
        <ButtonLink href="/participant" variant="ghost">
          ← Back to dashboard
        </ButtonLink>
      </div>
    </PageShell>
  );
}
