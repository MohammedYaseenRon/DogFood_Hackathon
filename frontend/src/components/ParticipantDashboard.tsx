"use client";

import { useEffect, useState } from "react";
import { fetchMeClient, fetchMyTeamClient, type UserInfo } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

type TeamInfo = {
  name: string;
  inviteToken: string;
  inviteUrl: string;
} | null;

const steps = [
  {
    step: 1,
    title: "Sign in",
    description: "Log in as a participant to access submission features.",
    done: true,
  },
  {
    step: 2,
    title: "Join a team",
    description: "Use an invite link from your teammate to join your team.",
    done: false,
  },
  {
    step: 3,
    title: "Submit project",
    description: "Fill in your project details and submit before the deadline.",
    done: false,
  },
  {
    step: 4,
    title: "Edit until deadline",
    description: "Update your draft anytime before submissions close.",
    done: false,
  },
];

export function ParticipantDashboard({
  submissionsOpen,
}: {
  submissionsOpen: boolean;
}) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [team, setTeam] = useState<TeamInfo | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchMeClient(), fetchMyTeamClient()]).then(([u, t]) => {
      setUser(u);
      setTeam(t?.team ?? null);
      setLoading(false);
    });
  }, []);

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
  const progressSteps = steps.map((s, i) => ({
    ...s,
    done: i === 0 ? true : i === 1 ? hasTeam : false,
  }));

  return (
    <div className="space-y-8">
      {/* Welcome card */}
      <Card variant="elevated" className="overflow-hidden p-0">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-6 text-white">
          <p className="text-sm font-medium text-amber-100">Welcome back</p>
          <h2 className="font-display mt-1 text-2xl font-bold">
            {user.name ?? user.email}
          </h2>
          <span className="mt-3 inline-block">
            <Badge tone="warning">PARTICIPANT</Badge>
          </span>
        </div>
        <div className="flex flex-wrap gap-3 p-6">
          <ButtonLink href="/projects/new">Submit project</ButtonLink>
          <ButtonLink href="/projects" variant="secondary">
            View gallery
          </ButtonLink>
        </div>
      </Card>

      {/* Submission status */}
      <Alert tone={submissionsOpen ? "success" : "warning"}>
        {submissionsOpen
          ? "Submissions are open. You can submit or edit your project until the deadline."
          : "Submissions are closed. No new submissions or edits are allowed."}
      </Alert>

      {/* Progress steps */}
      <div>
        <h3 className="font-display text-lg font-bold text-zinc-900">
          Your journey
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {progressSteps.map((item) => (
            <Card
              key={item.step}
              className={`relative ${item.done ? "border-emerald-200 bg-emerald-50/50" : ""}`}
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

      {/* Team section */}
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
                  Invite: /teams/join/{team.inviteToken}
                </p>
              </div>
              <Badge tone="success">Joined</Badge>
            </div>
            <p className="text-sm text-zinc-500">
              Share the invite link with teammates so they can join your team.
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-zinc-500">
              You haven&apos;t joined a team yet. Ask a teammate for an invite
              link, or sign in and visit their invite URL.
            </p>
            <ButtonLink href="/login" variant="secondary" className="mt-4">
              Need an invite link?
            </ButtonLink>
          </div>
        )}
      </Card>
    </div>
  );
}
