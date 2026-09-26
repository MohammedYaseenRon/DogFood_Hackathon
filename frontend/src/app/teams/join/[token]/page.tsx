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
    <main className="mx-auto max-w-xl px-6 py-10">
      <PageHeader
        title={`Join ${team.name}`}
        description="Team formation via invite link. Sign in as a participant before joining."
        action={<Badge tone="brand">{team.members.length} members</Badge>}
      />

      <Card className="mb-6">
        <h2 className="text-sm font-medium text-slate-500">Current members</h2>
        <ul className="mt-3 space-y-2">
          {team.members.map((member: { email: string; role: string }) => (
            <li
              key={member.email}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <span>{member.email}</span>
              <Badge>{member.role}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <JoinTeamPanel token={token} teamName={team.name} />
      </Card>
    </main>
  );
}
