"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  fetchMeClient,
  fetchMyRegistrationClient,
  fetchMyTeamClient,
  registerForEventClient,
  type EventInfo,
  type TeamSummary,
  type UserInfo,
} from "@/lib/api";
import { loginHref, registerHref } from "@/lib/role-auth";

type Participation = { user: UserInfo | null; registered: boolean; team: TeamSummary | null };

async function fetchParticipation(slug: string): Promise<Participation> {
  const user = await fetchMeClient();
  if (!user) return { user, registered: false, team: null };
  const [reg, mine] = await Promise.all([fetchMyRegistrationClient(slug), fetchMyTeamClient(slug)]);
  return { user, registered: Boolean(reg?.registered), team: mine?.team ?? null };
}

/**
 * Registration panel on an event page. Walks a visitor through
 * sign in → register → team → submit, showing only the next useful step.
 */
export function EventRegisterButton({ event }: { event: EventInfo }) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null | undefined>(undefined);
  const [registered, setRegistered] = useState(false);
  const [team, setTeam] = useState<TeamSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(data: Participation) {
    setUser(data.user);
    setRegistered(data.registered);
    setTeam(data.team);
  }

  useEffect(() => {
    let active = true;
    fetchParticipation(event.slug).then((data) => {
      if (active) apply(data);
    });
    return () => {
      active = false;
    };
  }, [event.slug]);

  async function register() {
    setError(null);
    setSubmitting(true);
    const result = await registerForEventClient(event.slug);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    apply(await fetchParticipation(event.slug));
    router.refresh();
  }

  if (user === undefined) {
    return <p className="text-sm text-zinc-500">Checking your registration…</p>;
  }

  const here = `/events/${event.slug}`;
  const { registrationOpen, teamFormationOpen, submissionsOpen } = event.state;

  if (!user) {
    if (!registrationOpen) {
      return (
        <Alert tone="warning" title="Registration closed">
          This event isn&apos;t accepting new participants right now.
        </Alert>
      );
    }
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-zinc-600">
          Create an account or sign in, then register to become a participant.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={registerHref(here)}>Create account</ButtonLink>
          <ButtonLink href={loginHref(here)} variant="secondary">
            Sign in
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (user.role !== "VISITOR" && user.role !== "PARTICIPANT") {
    return (
      <Alert tone="info" title={`Signed in as ${user.role.toLowerCase()}`}>
        Staff accounts can&apos;t join events as participants. Use a participant account to
        register.
      </Alert>
    );
  }

  if (team) {
    return (
      <div className="space-y-3">
        <Alert tone="success" title={`You're on ${team.name}`}>
          {team.project
            ? `Your project "${team.project.title}" is ${team.project.status === "SUBMITTED" ? "submitted" : "a draft"}.`
            : submissionsOpen
              ? "Next: start your project submission."
              : "Submissions aren't open yet."}
        </Alert>
        <div className="flex flex-wrap gap-3">
          {submissionsOpen ? (
            <ButtonLink href={`/projects/new?event=${event.slug}`}>
              {team.project ? "Edit project" : "Start submission"}
            </ButtonLink>
          ) : team.project ? (
            <ButtonLink href={`/projects/${team.project.id}`}>View project</ButtonLink>
          ) : null}
          <ButtonLink href={`/teams/${team.id}`} variant="secondary">
            Team page
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (registered) {
    return (
      <div className="space-y-3">
        <Alert tone="success" title="You're registered">
          {teamFormationOpen
            ? "Next: create a team, or open an invite link from a teammate."
            : "Team formation is closed for this event."}
        </Alert>
        {teamFormationOpen ? (
          <ButtonLink href={`/teams/new?event=${event.slug}`}>Create a team</ButtonLink>
        ) : null}
      </div>
    );
  }

  if (!registrationOpen) {
    return (
      <Alert tone="warning" title="Registration closed">
        This event isn&apos;t accepting new participants right now.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        Registering makes you a participant so you can form a team and submit.
      </p>
      <Button type="button" onClick={register} disabled={submitting} size="lg" className="w-full">
        {submitting ? "Registering…" : "Register for this event"}
      </Button>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
