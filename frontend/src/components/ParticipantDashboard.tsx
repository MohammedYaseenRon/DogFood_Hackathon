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
import { formatDateTime, phaseInfo } from "@/lib/format";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
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
      <div className="space-y-4" aria-busy="true">
        <div className="h-56 animate-pulse rounded-2xl bg-white/70" />
        <div className="h-24 animate-pulse rounded-2xl bg-white/50" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold text-ink">Sign in to see your hackathons</h2>
        <p className="mt-2 text-sm text-zinc-500">Use your account, or try the demo participant.</p>
        <div className="mt-6">
          <ParticipantSignInPanel embedded redirectTo="/participant" />
        </div>
      </div>
    );
  }

  if (user.role !== "PARTICIPANT" && user.role !== "VISITOR") {
    return (
      <Alert tone="info" title={`You're signed in as ${user.role.toLowerCase()}`}>
        The participant hub is for hackers — staff accounts can&apos;t register for events.{" "}
        <Link href="/login?mode=participant&redirect=/participant" className="font-semibold underline">
          Switch to a participant account
        </Link>
        .
      </Alert>
    );
  }

  return (
    <div className="space-y-14">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <section aria-labelledby="your-events">
        <h2 id="your-events" className="sr-only">
          Your events
        </h2>
        {entries.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white/60 px-6 py-12 text-center">
            <p className="font-display text-lg font-semibold text-ink">No events yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
              Register for an open event below, or open the invite link a teammate sent you.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {entries.map((entry) => (
              <EventTicket key={entry.event.slug} entry={entry} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="open-events">
        <div className="flex items-end justify-between gap-3 border-b border-line pb-3">
          <div>
            <h2 id="open-events" className="font-display text-lg font-semibold text-ink">
              Open for registration
            </h2>
            <p className="mt-1 text-sm text-zinc-500">Events you can still join.</p>
          </div>
          <Link href="/events" className="text-sm font-semibold text-brand-700 hover:underline">
            All events →
          </Link>
        </div>
        {openEvents.length === 0 ? (
          <p className="mt-5 text-sm text-zinc-500">You&apos;ve joined every open event.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {openEvents.map((event) => (
              <li key={event.slug} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/events/${event.slug}`} className="font-semibold text-ink hover:text-brand-700">
                    {event.name}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-zinc-500">
                    {event.shortDescription ?? `${event.tracks.length} tracks · teams of up to ${event.maxTeamSize}`}
                  </p>
                </div>
                <Countdown to={event.submissionsClose} />
                <Button size="sm" disabled={busy !== null} onClick={() => void register(event.slug)}>
                  {busy === event.slug ? "Registering…" : "Register"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

type NextStep = {
  label: string;
  title: string;
  body: string;
  action?: { href: string; label: string };
  secondary?: { href: string; label: string };
  tone: "go" | "done" | "locked";
};

function nextStep({ event, team, project }: ParticipantEntry): NextStep {
  const submitHref = `/projects/new?event=${event.slug}`;
  if (!team) {
    return event.teamFormationOpen
      ? {
          label: "Next step",
          title: "Form your team",
          body: "Create a team, or open the invite link a teammate sent you.",
          action: { href: `/teams/new?event=${event.slug}`, label: "Create team" },
          tone: "go",
        }
      : { label: "Closed", title: "Team formation closed", body: "This event no longer accepts new teams.", tone: "locked" };
  }
  if (!event.submissionsOpen) {
    return project?.status === "SUBMITTED"
      ? {
          label: "Locked in",
          title: "Submitted on time",
          body: "The deadline has passed. Your project is with the judges.",
          action: { href: `/projects/${project.id}`, label: "View project" },
          tone: "done",
        }
      : {
          label: "Closed",
          title: project ? "Draft not submitted" : "No project submitted",
          body: "The deadline has passed, so nothing can change now.",
          action: project ? { href: `/projects/${project.id}`, label: "View draft" } : undefined,
          tone: "locked",
        };
  }
  if (!project) {
    return {
      label: "Next step",
      title: "Start your submission",
      body: "A draft only needs a name and a track. Keep editing until the deadline.",
      action: { href: submitHref, label: "Start draft" },
      tone: "go",
    };
  }
  if (project.status === "DRAFT") {
    return {
      label: "Next step",
      title: "Finish and submit",
      body: "Drafts stay private. Submit to enter the gallery and judging.",
      action: { href: submitHref, label: "Continue draft" },
      secondary: { href: `/projects/${project.id}`, label: "Preview" },
      tone: "go",
    };
  }
  return {
    label: "Submitted",
    title: "You're in",
    body: "Keep polishing — edits save to your live entry until the deadline.",
    action: { href: submitHref, label: "Edit project" },
    secondary: { href: `/projects/${project.id}`, label: "View live page" },
    tone: "done",
  };
}

function EventTicket({ entry }: { entry: ParticipantEntry }) {
  const { event, team, project } = entry;
  const phase = phaseInfo(event.phase);
  const step = nextStep(entry);
  const stops = [
    { label: "Registered", done: entry.registered },
    { label: "Team", done: Boolean(team) },
    { label: "Draft", done: Boolean(project) },
    { label: "Submitted", done: project?.status === "SUBMITTED" },
  ];
  const current = stops.findIndex((stop) => !stop.done);

  return (
    <article className="grid overflow-hidden rounded-2xl border border-line bg-white md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={phase.tone}>{phase.label}</Badge>
          {event.submissionsOpen ? <Countdown to={event.submissionsClose} /> : null}
        </div>
        <h3 className="font-display mt-4 text-2xl font-semibold text-ink">
          <Link href={`/events/${event.slug}`} className="hover:text-brand-700">
            {event.name}
          </Link>
        </h3>
        <p className="mt-1.5 font-mono text-xs text-zinc-500">deadline {formatDateTime(event.submissionsClose)}</p>

        <ol className="mt-8 grid grid-cols-4" aria-label="Progress">
          {stops.map((stop, index) => {
            const isCurrent = index === current;
            return (
              <li key={stop.label} className="relative">
                {index > 0 ? (
                  <span
                    aria-hidden
                    className={`absolute right-1/2 top-[11px] h-0.5 w-full ${stop.done ? "bg-ink" : "bg-zinc-200"}`}
                  />
                ) : null}
                <span className="relative flex flex-col items-center gap-2 text-center">
                  <span
                    className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-semibold ${
                      stop.done
                        ? "bg-ink text-signal-300"
                        : isCurrent
                          ? "bg-signal-300 text-ink ring-4 ring-signal-100"
                          : "border border-zinc-300 bg-white text-zinc-400"
                    }`}
                  >
                    {stop.done ? "✓" : index + 1}
                  </span>
                  <span className={`text-xs font-medium ${stop.done || isCurrent ? "text-ink" : "text-zinc-400"}`}>
                    {stop.label}
                    <span className="sr-only">{stop.done ? " (done)" : isCurrent ? " (current)" : ""}</span>
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        <dl className="mt-8 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[11px] tracking-[0.12em] text-zinc-400 uppercase">Team</dt>
            {team ? (
              <dd className="mt-1.5">
                <Link href={`/teams/${team.id}`} className="font-semibold text-ink hover:text-brand-700">
                  {team.name}
                </Link>
                <p className="mt-0.5 text-sm text-zinc-500">
                  <span className="font-mono">
                    {team.memberCount}/{team.maxTeamSize}
                  </span>{" "}
                  members · you&apos;re {team.myRole.toLowerCase()}
                </p>
              </dd>
            ) : (
              <dd className="mt-1.5 text-sm text-zinc-500">Not on a team yet</dd>
            )}
          </div>
          <div>
            <dt className="font-mono text-[11px] tracking-[0.12em] text-zinc-400 uppercase">Project</dt>
            {project ? (
              <dd className="mt-1.5">
                <Link href={`/projects/${project.id}`} className="font-semibold text-ink hover:text-brand-700">
                  {project.title || "Untitled project"}
                </Link>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {project.status === "SUBMITTED"
                    ? `Submitted ${formatDateTime(project.submittedAt)}`
                    : "Draft · only your team can see it"}
                </p>
              </dd>
            ) : (
              <dd className="mt-1.5 text-sm text-zinc-500">Not started</dd>
            )}
          </div>
        </dl>
      </div>

      <aside
        className={`ticket-tear flex flex-col justify-between gap-6 p-6 sm:p-8 ${
          step.tone === "go" ? "bg-signal-50" : step.tone === "done" ? "bg-emerald-50/60" : "bg-zinc-50"
        }`}
      >
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">{step.label}</p>
          <p className="font-display mt-3 text-xl leading-snug font-semibold text-ink">{step.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{step.body}</p>
        </div>
        <div className="flex flex-col gap-2">
          {step.action ? (
            <ButtonLink href={step.action.href} variant={step.tone === "go" ? "primary" : "secondary"} className="w-full">
              {step.action.label} →
            </ButtonLink>
          ) : null}
          {step.secondary ? (
            <Link href={step.secondary.href} className="text-center text-sm font-medium text-zinc-600 hover:text-ink">
              {step.secondary.label}
            </Link>
          ) : null}
          {team && step.tone !== "locked" ? (
            <Link href={`/teams/${team.id}`} className="text-center text-sm font-medium text-zinc-600 hover:text-ink">
              {team.myRole === "MEMBER" ? "Open team" : "Manage team & invites"}
            </Link>
          ) : null}
        </div>
      </aside>
    </article>
  );
}
