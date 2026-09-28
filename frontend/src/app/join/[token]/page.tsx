import { JoinTeamPanel } from "@/components/JoinTeamPanel";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchInvitePreview } from "@/lib/api";

type JoinPageProps = {
  params: Promise<{ token: string }>;
};

export default async function JoinTeamPage({ params }: JoinPageProps) {
  const { token } = await params;
  const preview = await fetchInvitePreview(token);

  if (!preview) {
    return (
      <main className="min-h-screen bg-zinc-50/80">
        <div className="mx-auto max-w-xl px-6 py-16">
          <EmptyState
            title="Invitation unavailable"
            description="This invite link is invalid, expired, revoked, or has reached its usage limit."
            action={
              <ButtonLink href="/participant" variant="primary">
                Go to dashboard
              </ButtonLink>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50/80 pb-16">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-xl px-6 py-10">
          <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">
            Team invitation
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold text-zinc-950">
            Join {preview.team.name}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            You&apos;ve been invited to collaborate on this hackathon team.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="brand">{preview.team.memberCount} members</Badge>
            {preview.remainingUses != null ? (
              <Badge tone="default">{preview.remainingUses} spots left</Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-6 px-6 py-8">
        <Card variant="elevated">
          <h2 className="text-sm font-semibold text-zinc-400">Current members</h2>
          <ul className="mt-4 space-y-2">
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

        <Card variant="elevated">
          <JoinTeamPanel
            token={token}
            teamName={preview.team.name}
            teamId={preview.team.id}
          />
        </Card>
      </div>
    </main>
  );
}
