"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchTeamClient,
  fetchTeamMembersClient,
  type TeamMemberInfo,
  type TeamSummary,
} from "@/lib/api";
import { InviteMembersSection } from "@/components/InviteMembersSection";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const roleTone = {
  OWNER: "brand" as const,
  ADMIN: "cyan" as const,
  MEMBER: "default" as const,
};

export function TeamPageContent({ teamId }: { teamId: string }) {
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [members, setMembers] = useState<TeamMemberInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [teamRes, membersRes] = await Promise.all([
      fetchTeamClient(teamId),
      fetchTeamMembersClient(teamId),
    ]);
    if (!teamRes?.team) {
      setError("Team not found or you do not have access.");
      setTeam(null);
      setMembers([]);
      return;
    }
    setTeam(teamRes.team);
    setMembers(membersRes?.members ?? []);
    setError(null);
  }, [teamId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Alert tone="error">{error ?? "Unable to load team."}</Alert>
        <ButtonLink href="/participant" variant="secondary" className="mt-4">
          Back to dashboard
        </ButtonLink>
      </div>
    );
  }

  const canManageInvites =
    team.myRole === "OWNER" || team.myRole === "ADMIN";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">
            Your team
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold text-zinc-950">{team.name}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {team.memberCount ?? members.length} member
            {(team.memberCount ?? members.length) === 1 ? "" : "s"}
            {team.myRole ? (
              <>
                {" "}
                · You are <span className="font-semibold text-zinc-700">{team.myRole}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/participant" variant="secondary" size="sm">
            Dashboard
          </ButtonLink>
          <ButtonLink href="/projects/new" size="sm">
            Submit project
          </ButtonLink>
        </div>
      </div>

      <Card>
        <h2 className="font-display text-lg font-bold text-zinc-950">Members</h2>
        <ul className="mt-4 divide-y divide-zinc-100">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <p className="font-semibold text-zinc-900">{member.name}</p>
                <p className="text-sm text-zinc-500">{member.email}</p>
              </div>
              <Badge tone={roleTone[member.role]}>{member.role}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      {canManageInvites ? <InviteMembersSection teamId={teamId} /> : null}
    </div>
  );
}
