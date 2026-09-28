import { JoinTeamPanel } from "@/components/JoinTeamPanel";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSection, PageShell } from "@/components/ui/PageShell";
import { fetchInvitePreview } from "@/lib/api";

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
      description="You've been invited to collaborate on this hackathon team."
      maxWidth="max-w-xl"
      badge={
        <>
          <Badge tone="brand">{preview.team.memberCount} members</Badge>
          {preview.remainingUses != null ? (
            <Badge tone="default">{preview.remainingUses} spots left</Badge>
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
