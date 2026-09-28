"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchEventsClient,
  fetchMeClient,
  fetchParticipantOverviewClient,
  registerForEventClient,
  type EventInfo,
  type ParticipantEntry,
  type UserInfo,
} from "@/lib/api";
import { formatDateTime, phaseInfo, relativeTime } from "@/lib/format";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ParticipantSignInPanel } from "@/components/ParticipantSignInPanel";

type HubData = { user: UserInfo | null; entries: ParticipantEntry[]; openEvents: EventInfo[] };

async function fetchHub(): Promise<HubData> {
  const user = await fetchMeClient();
  if (!user) return { user, entries: [], openEvents: [] };
  const [overview, events] = await Promise.all([fetchParticipantOverviewClient(), fetchEventsClient()]);
  const entries = overview ?? [];
  const joined = new Set(entries.map((entry) => entry.event.slug));
  return {
    user,
    entries,
    openEvents: events.filter((event) => event.state.registrationOpen && !joined.has(event.slug)),
  };
}

export function ParticipantDashboard() {
  const [user, setUser] = useState<UserInfo | null | undefined>(undefined);
  const [entries, setEntries] = useState<ParticipantEntry[]>([]);
  const [openEvents, setOpenEvents] = useState<EventInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function apply(data: HubData) {
    setUser(data.user);
    setEntries(data.entries);
    setOpenEvents(data.openEvents);
  }

  useEffect(() => {
    let active = true;
    fetchHub().then((data) => {
      if (active) apply(data);
    });
    return () => {
      active = false;
    };
  }, []);

  async function register(slug: string) {
    setError(null);
    setBusy(slug);
    const result = await registerForEventClient(slug);
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    apply(await fetchHub());
  }

  if (user === undefined) {
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
          <h2 className="font-display text-xl font-bold text-zinc-900">Sign in to see your hackathons</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Use your account, or the demo participant below.
          </p>
        </div>
        <ParticipantSignInPanel embedded redirectTo="/participant" />
      </Card>
    );
  }

  if (user.role !== "PARTICIPANT" && user.role !== "VISITOR") {
    return (
      <Alert tone="info" title={`You're signed in as ${user.role.toLowerCase()}`}>
        The participant hub is for hackers. Staff accounts can&apos;t register for events —{" "}
        <Link href="/login?mode=participant&redirect=/participant" className="font-semibold underline">
          switch to a participant account
        </Link>
        .
      </Alert>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">Signed in as</p>
          <p className="font-display mt-1 text-xl font-bold text-zinc-950">{user.name ?? user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="warning">{user.role}</Badge>
          <ButtonLink href="/account" variant="secondary" size="sm">
            Account
          </ButtonLink>
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <section>
        <h2 className="font-display text-xl font-bold text-zinc-900">Your hackathons</h2>
        {entries.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-zinc-600">
              You haven&apos;t joined an event yet. Register for one below, or open a team invite link
              from a teammate.
            </p>
          </Card>
        ) : (
          <div className="mt-4 space-y-5">
            {entries.map((entry) => (
              <EventProgress key={entry.event.slug} entry={entry} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-zinc-900">Open for registration</h2>
            <p className="mt-1 text-sm text-zinc-500">Events you can still join.</p>
          </div>
          <ButtonLink href="/events" variant="ghost" size="sm">
            All events →
          </ButtonLink>
        </div>
        {openEvents.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No other events are open right now.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {openEvents.map((event) => (
              <Card key={event.slug}>
                <Link href={`/events/${event.slug}`} className="font-display text-lg font-bold text-zinc-900 hover:text-violet-700">
                  {event.name}
                </Link>
                {event.shortDescription ? (
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{event.shortDescription}</p>
                ) : null}
                <p className="mt-3 text-xs text-zinc-500">
                  Submissions close {formatDateTime(event.submissionsClose)}
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => void register(event.slug)}
                >
                  {busy === event.slug ? "Registering…" : "Register"}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EventProgress({ entry }: { entry: ParticipantEntry }) {
  const { event, team, project } = entry;
  const phase = phaseInfo(event.phase);
  const steps = [
    { label: "Registered", done: entry.registered },
    { label: "On a team", done: Boolean(team) },
    { label: "Project started", done: Boolean(project) },
    { label: "Submitted", done: project?.status === "SUBMITTED" },
  ];

  return (
    <Card variant="elevated" className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-100 p-5">
        <div>
          <Link href={`/events/${event.slug}`} className="font-display text-lg font-bold text-zinc-900 hover:text-violet-700">
            {event.name}
          </Link>
          <p className="mt-1 text-sm text-zinc-500">
            Deadline {formatDateTime(event.submissionsClose)}
            {event.submissionsOpen ? ` · ${relativeTime(event.submissionsClose)}` : ""}
          </p>
        </div>
        <Badge tone={phase.tone}>{phase.label}</Badge>
      </div>

      <ol className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-4">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
              step.done ? "bg-emerald-50 text-emerald-800" : "bg-zinc-50 text-zinc-500"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step.done ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-600"
              }`}
            >
              {step.done ? "✓" : index + 1}
            </span>
            {step.label}
          </li>
        ))}
      </ol>

      <div className="grid gap-4 border-t border-zinc-100 p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">Team</p>
          {team ? (
            <>
              <p className="mt-1 font-semibold text-zinc-900">{team.name}</p>
              <p className="text-sm text-zinc-500">
                {team.memberCount}/{team.maxTeamSize} members · you are {team.myRole.toLowerCase()}
              </p>
              <ButtonLink href={`/teams/${team.id}`} variant="secondary" size="sm" className="mt-3">
                {team.myRole === "MEMBER" ? "Open team" : "Manage team & invites"}
              </ButtonLink>
            </>
          ) : event.teamFormationOpen ? (
            <>
              <p className="mt-1 text-sm text-zinc-600">Create a team, or open an invite link from a teammate.</p>
              <ButtonLink href={`/teams/new?event=${event.slug}`} size="sm" className="mt-3">
                Create team
              </ButtonLink>
            </>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">Team formation is closed.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">Project</p>
          {project ? (
            <>
              <p className="mt-1 font-semibold text-zinc-900">{project.title || "Untitled project"}</p>
              <p className="text-sm text-zinc-500">
                {project.status === "SUBMITTED"
                  ? `Submitted ${formatDateTime(project.submittedAt)}`
                  : "Draft — not visible in the gallery yet"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {event.submissionsOpen ? (
                  <ButtonLink href={`/projects/new?event=${event.slug}`} size="sm">
                    Edit project
                  </ButtonLink>
                ) : null}
                <ButtonLink href={`/projects/${project.id}`} variant="secondary" size="sm">
                  View
                </ButtonLink>
              </div>
            </>
          ) : team && event.submissionsOpen ? (
            <>
              <p className="mt-1 text-sm text-zinc-600">No project yet. Start a draft — you can edit until the deadline.</p>
              <ButtonLink href={`/projects/new?event=${event.slug}`} size="sm" className="mt-3">
                Start submission
              </ButtonLink>
            </>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">
              {event.submissionsOpen ? "Join a team first." : "Submissions are closed."}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
