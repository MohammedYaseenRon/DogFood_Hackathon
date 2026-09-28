"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchMeClient,
  fetchMyProjectClient,
  fetchMyTeamClient,
  type MyProject,
  type TeamSummary,
  type UserInfo,
} from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function ParticipantDashboard({
  submissionsOpen,
}: {
  submissionsOpen: boolean;
}) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [team, setTeam] = useState<TeamSummary | null | undefined>(undefined);
  const [project, setProject] = useState<MyProject | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    return Promise.all([
      fetchMeClient(),
      fetchMyTeamClient(),
      fetchMyProjectClient(),
    ]).then(([u, t, p]) => {
      setUser(u);
      setTeam(t?.team ?? null);
      setProject(p?.project ?? null);
    });
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  if (!user || user.role !== "PARTICIPANT") {
    return (
      <EmptyState
        title="Participant access required"
        description="Sign in as a participant to join teams and submit projects."
        action={
          <ButtonLink href="/login" variant="primary">
            Sign in as participant
          </ButtonLink>
        }
      />
    );
  }

  const hasTeam = team !== null && team !== undefined;
  const hasProject = project !== null && project !== undefined;
  const steps = [
    { step: 1, title: "Sign in", description: "Log in as a participant.", done: true },
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
