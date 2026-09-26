import { JoinTeamPanel } from "@/components/JoinTeamPanel";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { backendUrl } from "@/lib/api";

type JoinTeamPageProps = {
  params: Promise<{ token: string }>;
};

async function fetchTeam(token: string) {
  const res = await fetch(`${backendUrl}/api/teams/invite/${token}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function JoinTeamPage({ params }: JoinTeamPageProps) {
  const { token } = await params;
  const team = await fetchTeam(token);

  if (!team) {
    return (
      <main className="mx-auto max-w-xl px-6 py-10">
        <EmptyState
          title="Invite link not found"
          description="This team invite may have expired or the link is invalid."
        />
      </main>
    );
  }

  return (
    <main>
      <PageHeader
        variant="hero"
        title={`Join ${team.name}`}
        description="Team formation via invite link. Sign in as a participant before joining."
        badge={<Badge tone="brand">{team.members.length} members</Badge>}
      />

      <div className="mx-auto max-w-xl space-y-6 px-6 py-10">
        <Card variant="elevated">
          <h2 className="text-sm font-semibold text-zinc-400">Current members</h2>
          <ul className="mt-4 space-y-2">
            {team.members.map((member: { email: string; role: string }) => (
              <li
                key={member.email}
                className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 text-sm"
              >
                <span className="font-medium text-zinc-700">{member.email}</span>
                <Badge>{member.role}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card variant="elevated">
          <JoinTeamPanel token={token} teamName={team.name} />
        </Card>
      </div>
    </main>
  );
}
