"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchMeClient,
  fetchMyProjectClient,
  fetchMyRegistrationClient,
  fetchMyTeamClient,
  registerForEventClient,
  type MyProject,
  type TeamSummary,
  type UserInfo,
} from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ParticipantSignInPanel } from "@/components/ParticipantSignInPanel";

export function ParticipantDashboard({
  submissionsOpen,
}: {
  submissionsOpen: boolean;
}) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [team, setTeam] = useState<TeamSummary | null | undefined>(undefined);
  const [project, setProject] = useState<MyProject | null | undefined>(undefined);
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const reload = useCallback(() => {
    return Promise.all([
      fetchMeClient(),
      fetchMyTeamClient(),
      fetchMyProjectClient(),
      fetchMyRegistrationClient(),
    ]).then(([u, t, p, reg]) => {
      setUser(u);
      setTeam(t?.team ?? null);
      setProject(p?.project ?? null);
      setRegistered(Boolean(reg?.registered));
    });
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  async function joinEvent() {
    setJoinError(null);
    setJoining(true);
    const result = await registerForEventClient();
    setJoining(false);
    if (result.error) {
      setJoinError(result.error);
      return;
    }
    await reload();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card variant="elevated" className="mx-auto max-w-lg p-6 sm:p-8">
        <div className="mb-6 text-center">
          <h2 className="font-display text-xl font-bold text-zinc-900">
            Participant access required
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Sign in with your account or use the demo participant below.
          </p>
        </div>
        <ParticipantSignInPanel embedded redirectTo="/participant" />
      </Card>
    );
  }

  // Logged in but not yet a participant — guide to event registration
  if (user.role !== "PARTICIPANT") {
    return (
      <div className="space-y-6">
        <Card variant="elevated" className="overflow-hidden p-0">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-100">
              Almost there
            </p>
            <h2 className="font-display mt-1 text-2xl font-bold">
              You&apos;re signed in as {user.role}
            </h2>
            <p className="mt-2 text-sm text-amber-50">
              Register for a hackathon to unlock teams, invites, and project
              submissions.
            </p>
          </div>
          <div className="space-y-4 p-6">
            <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Signed in as{" "}
              <span className="font-semibold text-zinc-900">
                {user.name || user.email}
              </span>
            </div>

            {user.role === "VISITOR" ? (
              <div className="flex flex-wrap gap-3">
                <Button onClick={joinEvent} disabled={joining}>
                  {joining ? "Registering..." : "Register for Sample Hack 2026"}
                </Button>
                <ButtonLink href="/events" variant="secondary">
                  Browse all events
                </ButtonLink>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/events">Browse events</ButtonLink>
                <ButtonLink href="/login" variant="secondary">
                  Switch to Participant demo
                </ButtonLink>
              </div>
            )}

            {joinError ? <Alert tone="error">{joinError}</Alert> : null}

            <p className="text-xs text-zinc-400">
              Prefer a demo account?{" "}
              <a href="/login" className="font-semibold text-violet-600">
                Switch role → Participant
              </a>
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const hasTeam = team !== null && team !== undefined;
  const hasProject = project !== null && project !== undefined;
  const steps = [
    { step: 1, title: "Signed in", description: "You're a participant.", done: true },
    {
      step: 2,
      title: "Join a team",
      description: "Create a team or join via invite link.",
      done: hasTeam,
    },
    {
      step: 3,
      title: "Submit project",
      description: "Fill in project details and submit.",
      done: hasProject && project?.status === "SUBMITTED",
    },
    {
      step: 4,
      title: "Edit until deadline",
      description: "Update your draft anytime before close.",
      done: hasProject,
    },
  ];

  return (
    <div className="space-y-8">
      {!registered ? (
        <Alert tone="info" title="Tip">
          You have participant access. Create a team and submit when ready.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            Signed in as
          </p>
          <p className="font-display mt-2 text-xl font-bold text-zinc-950">
            {user.name ?? user.email}
          </p>
          <span className="mt-2 inline-block">
            <Badge tone="warning">PARTICIPANT</Badge>
          </span>
        </div>
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            Team status
          </p>
          <p className="font-display mt-2 text-xl font-bold text-zinc-950">
            {hasTeam ? team?.name : "No team yet"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {hasTeam ? "Ready to collaborate" : "Create or join a team"}
          </p>
        </div>
        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">
            Project
          </p>
          <p className="font-display mt-2 text-xl font-bold text-zinc-950">
            {hasProject ? project?.title : "Not submitted"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {hasProject ? project?.status : "Start your submission"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/projects/new">Submit project</ButtonLink>
        <ButtonLink href="/projects" variant="secondary">
          View gallery
        </ButtonLink>
        {hasTeam && team ? (
          <ButtonLink href={`/teams/${team.id}`} variant="secondary">
            Open team
          </ButtonLink>
        ) : (
          <ButtonLink href="/teams/new" variant="secondary">
            Create team
          </ButtonLink>
        )}
      </div>

      <Alert tone={submissionsOpen ? "success" : "warning"}>
        {submissionsOpen
          ? "Submissions are open. Save drafts or submit before the deadline."
          : "Submissions are closed. No new submissions or edits are allowed."}
      </Alert>

      <div>
        <h3 className="font-display text-lg font-bold text-zinc-900">
          Your journey
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item) => (
            <Card
              key={item.step}
              className={item.done ? "border-emerald-200 bg-emerald-50/50" : ""}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  item.done
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {item.done ? "✓" : item.step}
              </div>
              <h4 className="mt-3 font-semibold text-zinc-900">{item.title}</h4>
              <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <h3 className="font-display text-lg font-bold text-zinc-900">
          Your team
        </h3>
        {hasTeam && team ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3">
              <div>
                <p className="font-semibold text-zinc-900">{team.name}</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Role: {team.myRole ?? "MEMBER"}
                </p>
              </div>
              <Badge tone="success">Joined</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/teams/${team.id}`}>Open team page</ButtonLink>
              {(team.myRole === "OWNER" || team.myRole === "ADMIN") && (
                <ButtonLink href={`/teams/${team.id}`} variant="secondary">
                  Invite members
                </ButtonLink>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-zinc-500">
              Create a new team or join an existing one with an invite link.
            </p>
            <ButtonLink href="/teams/new">Create team</ButtonLink>
          </div>
        )}
      </Card>

      {hasProject && project ? (
        <Card>
          <h3 className="font-display text-lg font-bold text-zinc-900">
            Your project
          </h3>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-zinc-900">{project.title}</p>
              <p className="mt-1 text-sm text-zinc-500">{project.summary}</p>
              <p className="mt-2 text-xs text-zinc-400">
                Track: {project.trackName} · Team: {project.teamName}
              </p>
            </div>
            <Badge tone={project.status === "SUBMITTED" ? "success" : "warning"}>
              {project.status}
            </Badge>
          </div>
          <ButtonLink href="/projects/new" variant="secondary" className="mt-4">
            Edit project
          </ButtonLink>
        </Card>
      ) : null}
    </div>
  );
}
