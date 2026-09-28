import { JoinTeamPanel } from "@/components/JoinTeamPanel";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSection, PageShell } from "@/components/ui/PageShell";
import { Alert } from "@/components/ui/Alert";
import { formatDateTime } from "@/lib/format";
import { fetchInvitePreview } from "@/lib/server-api";

type JoinPageProps = {
  params: Promise<{ token: string }>;
};

export default async function JoinTeamPage({ params }: JoinPageProps) {
  const { token } = await params;
  const preview = await fetchInvitePreview(token);

  if (!preview) {
    return (
      <PageShell
        tone="amber"
        title="Invitation unavailable"
        description="This invite link is invalid, expired, revoked, or has reached its usage limit."
        maxWidth="max-w-xl"
      >
        <EmptyState
          title="Link not valid"
          description="Ask your team owner to generate a new invite link."
          action={
            <ButtonLink href="/participant" variant="primary">
              Go to dashboard
            </ButtonLink>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      tone="amber"
      eyebrow="Team invitation"
      title={`Join ${preview.team.name}`}
      description={
        preview.event
          ? `You've been invited to join this team for ${preview.event.name}.`
          : "You've been invited to collaborate on this hackathon team."
      }
      maxWidth="max-w-xl"
      badge={
        <>
          <Badge tone="brand">
            {preview.team.memberCount}/{preview.team.maxTeamSize} members
          </Badge>
          {preview.remainingUses != null ? (
            <Badge tone="default">{preview.remainingUses} invite uses left</Badge>
          ) : null}
        </>
      }
    >
      <div className="space-y-6">
        <PageSection title="Current members">
          <Card variant="elevated">
            <ul className="space-y-2">
              {preview.members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-zinc-700">{member.name}</span>
                  <Badge tone={member.role === "OWNER" ? "brand" : "default"}>
                    {member.role}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </PageSection>

        {preview.event && !preview.event.teamFormationOpen ? (
          <Alert tone="warning" title="Team formation is closed">
            {preview.event.name} stopped accepting team changes (deadline{" "}
            {formatDateTime(preview.event.submissionsClose)}).
          </Alert>
        ) : null}
        {preview.team.memberCount >= preview.team.maxTeamSize ? (
          <Alert tone="warning" title="This team is full">
            Ask the team owner to make room, or create your own team.
          </Alert>
        ) : null}
        {preview.expiresAt ? (
          <p className="text-sm text-zinc-500">This link expires {formatDateTime(preview.expiresAt)}.</p>
        ) : null}

        <Card variant="elevated">
          <JoinTeamPanel
            token={token}
            teamName={preview.team.name}
            teamId={preview.team.id}
          />
        </Card>
      </div>
    </PageShell>
  );
}
