"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  changeTeamMemberRoleClient,
  fetchMeClient,
  fetchTeamClient,
  fetchTeamMembersClient,
  removeTeamMemberClient,
  updateTeamClient,
  type TeamMemberInfo,
  type TeamSummary,
} from "@/lib/api";
import { InviteMembersSection } from "@/components/InviteMembersSection";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDateTime, phaseInfo } from "@/lib/format";
import { loginHref } from "@/lib/role-auth";

const roleTone = {
  OWNER: "brand" as const,
  ADMIN: "cyan" as const,
  MEMBER: "default" as const,
};

type TeamData = {
  myUserId: string | null;
  team: TeamSummary | null;
  members: TeamMemberInfo[];
  error: { status: number; message: string } | null;
};

async function fetchTeamData(teamId: string): Promise<TeamData> {
  const [me, teamRes, membersRes] = await Promise.all([
    fetchMeClient(),
    fetchTeamClient(teamId),
    fetchTeamMembersClient(teamId),
  ]);
  if (!teamRes.data?.team) {
    return {
      myUserId: me?.id ?? null,
      team: null,
      members: [],
      error: { status: teamRes.status, message: teamRes.error ?? "Team not found." },
    };
  }
  return { myUserId: me?.id ?? null, team: teamRes.data.team, members: membersRes?.members ?? [], error: null };
}

export function TeamPageContent({ teamId }: { teamId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [members, setMembers] = useState<TeamMemberInfo[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function apply(data: TeamData) {
    setMyUserId(data.myUserId);
    setTeam(data.team);
    setMembers(data.members);
    setLoadError(data.error);
    if (data.team) {
      setName(data.team.name);
      setDescription(data.team.description ?? "");
    }
    setLoading(false);
  }

  async function load() {
    apply(await fetchTeamData(teamId));
  }

  useEffect(() => {
    let active = true;
    fetchTeamData(teamId).then((data) => {
      if (active) apply(data);
    });
    return () => {
      active = false;
    };
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  if (loadError || !team) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        <Alert tone="error">
          {loadError?.status === 401
            ? "Sign in to view this team."
            : loadError?.status === 403
              ? "Only members of this team can view it."
              : (loadError?.message ?? "Unable to load team.")}
        </Alert>
        <div className="flex gap-2">
          {loadError?.status === 401 ? (
            <ButtonLink href={loginHref(`/teams/${teamId}`)}>Sign in</ButtonLink>
          ) : null}
          <ButtonLink href="/participant" variant="secondary">
            Back to dashboard
          </ButtonLink>
        </div>
      </div>
    );
  }

  const canManage = team.myRole === "OWNER" || team.myRole === "ADMIN";
  const isOwner = team.myRole === "OWNER";
  const windowOpen = team.event?.teamFormationOpen ?? false;
  const submissionsOpen = team.event?.submissionsOpen ?? false;
  const full = members.length >= team.maxTeamSize;
  const me = members.find((m) => m.userId === myUserId);

  async function run(key: string, action: () => Promise<{ error: string | null }>) {
    setActionError(null);
    setBusy(key);
    const result = await action();
    setBusy(null);
    if (result.error) {
      setActionError(result.error);
      return false;
    }
    return true;
  }

  async function saveTeam(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run("save", () => updateTeamClient(teamId, name.trim(), description.trim()));
    if (ok) {
      setEditing(false);
      await load();
    }
  }

  async function remove(member: TeamMemberInfo) {
    const leaving = member.userId === myUserId;
    const prompt = leaving
      ? `Leave ${team!.name}? You'll need a new invite to rejoin.`
      : `Remove ${member.name} from the team?`;
    if (!window.confirm(prompt)) return;
    const ok = await run(`remove-${member.id}`, () => removeTeamMemberClient(teamId, member.id));
    if (!ok) return;
    if (leaving) {
      router.push("/participant");
      router.refresh();
    } else {
      await load();
    }
  }

  async function setRole(member: TeamMemberInfo, role: "OWNER" | "ADMIN" | "MEMBER") {
    if (role === "OWNER" && !window.confirm(`Make ${member.name} the owner? You'll become an admin.`)) {
      return;
    }
    const ok = await run(`role-${member.id}`, () => changeTeamMemberRoleClient(teamId, member.id, role));
    if (ok) await load();
  }

  const phase = team.event ? phaseInfo(team.event.phase) : null;

  return (
    <div>
      <div className="relative overflow-hidden border-b border-white/60 bg-gradient-to-br from-amber-50 via-white to-orange-50/80">
        <div className="page-dot-grid absolute inset-0 opacity-50" />
        <div className="relative mx-auto flex max-w-4xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-amber-600 uppercase">Your team</p>
            <h1 className="font-display mt-3 text-3xl font-bold text-zinc-950">{team.name}</h1>
            {team.description ? <p className="mt-2 max-w-xl text-sm text-zinc-600">{team.description}</p> : null}
            <p className="mt-2 text-sm text-zinc-600">
              {members.length}/{team.maxTeamSize} members
              {team.myRole ? (
                <>
                  {" "}· You are <span className="font-semibold text-zinc-800">{team.myRole.toLowerCase()}</span>
                </>
              ) : null}
            </p>
            {team.event ? (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                <Link href={`/events/${team.event.slug}`} className="font-semibold text-zinc-800 hover:underline">
                  {team.event.name}
                </Link>
                {phase ? <Badge tone={phase.tone}>{phase.label}</Badge> : null}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/participant" variant="secondary" size="sm">
              Dashboard
            </ButtonLink>
            {team.project ? (
              <ButtonLink href={`/projects/${team.project.id}`} variant="secondary" size="sm">
                View project
              </ButtonLink>
            ) : null}
            {submissionsOpen && team.event ? (
              <ButtonLink href={`/projects/new?event=${team.event.slug}`} size="sm">
                {team.project ? "Edit project" : "Start submission"}
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </div>

      <div className="page-surface mx-auto max-w-4xl space-y-6 px-6 py-8">
        {searchParams.get("created") ? (
          <Alert tone="success" title="Team created">
            Generate an invite link below and share it with your teammates.
          </Alert>
        ) : null}
        {!windowOpen ? (
          <Alert tone="warning">
            Team changes are closed for this event
            {team.event ? ` (deadline ${formatDateTime(team.event.submissionsClose)})` : ""}.
          </Alert>
        ) : null}
        {actionError ? <Alert tone="error">{actionError}</Alert> : null}

        {team.project ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">Project</p>
                <p className="mt-1 font-semibold text-zinc-900">{team.project.title || "Untitled"}</p>
              </div>
              <Badge tone={team.project.status === "SUBMITTED" ? "success" : "warning"}>
                {team.project.status === "SUBMITTED" ? "Submitted" : "Draft"}
              </Badge>
            </div>
          </Card>
        ) : null}

        {canManage && editing ? (
          <Card>
            <form onSubmit={saveTeam} className="space-y-4">
              <h2 className="font-display text-lg font-bold text-zinc-950">Edit team</h2>
              <div>
                <label htmlFor="edit-team-name" className="mb-2 block text-sm font-semibold text-zinc-700">
                  Name
                </label>
                <input
                  id="edit-team-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="edit-team-desc" className="mb-2 block text-sm font-semibold text-zinc-700">
                  Description
                </label>
                <textarea
                  id="edit-team-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy === "save"}>
                  {busy === "save" ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-zinc-950">Members</h2>
            {canManage && windowOpen && !editing ? (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Edit team
              </Button>
            ) : null}
          </div>
          <ul className="mt-4 divide-y divide-zinc-100">
            {members.map((member) => {
              const isMe = member.userId === myUserId;
              const canRemove =
                windowOpen && (isMe ? member.role !== "OWNER" : canManage && member.role !== "OWNER");
              return (
                <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-semibold text-zinc-900">
                      {member.name}
                      {isMe ? <span className="ml-1.5 text-xs font-normal text-zinc-400">(you)</span> : null}
                    </p>
                    <p className="text-sm text-zinc-500">{member.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={roleTone[member.role]}>{member.role}</Badge>
                    {isOwner && !isMe ? (
                      <select
                        aria-label={`Role for ${member.name}`}
                        value=""
                        disabled={busy !== null}
                        onChange={(e) => {
                          const value = e.target.value as "OWNER" | "ADMIN" | "MEMBER";
                          if (value) void setRole(member, value);
                        }}
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700"
                      >
                        <option value="">Change role…</option>
                        {member.role !== "ADMIN" ? <option value="ADMIN">Make admin</option> : null}
                        {member.role !== "MEMBER" ? <option value="MEMBER">Make member</option> : null}
                        <option value="OWNER">Transfer ownership</option>
                      </select>
                    ) : null}
                    {canRemove ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void remove(member)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        {isMe ? "Leave" : "Remove"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {me?.role === "OWNER" && members.length > 1 ? (
            <p className="mt-4 text-xs text-zinc-400">To leave, transfer ownership to another member first.</p>
          ) : null}
        </Card>

        {canManage && windowOpen ? (
          full ? (
            <Alert tone="info">The team is full ({team.maxTeamSize} members).</Alert>
          ) : (
            <InviteMembersSection teamId={teamId} />
          )
        ) : null}
      </div>
    </div>
  );
}
