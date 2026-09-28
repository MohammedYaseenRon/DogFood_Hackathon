"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMeClient, type UserInfo } from "@/lib/api";
import { ButtonLink } from "@/components/ui/Button";
import { FormPageLayout } from "@/components/ui/FormPageLayout";
import { loginHref } from "@/lib/role-auth";

/** Submit CTA that only shows for participants; others get a clear next step. */
export function SubmitProjectCta({
  size = "sm",
  className = "",
  label = "Submit project",
  event,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
  /** Event slug to submit to; defaults to the participant's open event. */
  event?: string;
}) {
  const [user, setUser] = useState<UserInfo | null | undefined>(undefined);

  useEffect(() => {
    fetchMeClient().then(setUser);
  }, []);

  if (user === undefined) {
    return (
      <span
        className={`inline-flex h-10 w-32 animate-pulse rounded-lg bg-zinc-200/70 ${className}`}
      />
    );
  }

  if (user?.role === "PARTICIPANT") {
    return (
      <ButtonLink
        href={event ? `/projects/new?event=${event}` : "/participant"}
        size={size}
        className={className}
      >
        {event ? label : "My submissions"}
      </ButtonLink>
    );
  }

  if (user?.role === "VISITOR") {
    return (
      <ButtonLink
        href={event ? `/events/${event}` : "/events"}
        size={size}
        variant="secondary"
        className={className}
      >
        Register for an event to submit
      </ButtonLink>
    );
  }

  if (user) return null;

  return (
    <ButtonLink
      href={`/login?redirect=${encodeURIComponent(event ? `/events/${event}` : "/events")}`}
      size={size}
      className={className}
    >
      Sign in to submit
    </ButtonLink>
  );
}

function GateAside({
  title,
  items,
}: {
  title: string;
  items: { title: string; body: string }[];
}) {
  return (
    <div className="relative h-full overflow-hidden rounded-2xl bg-ink p-6 text-white sm:p-8">
      <div aria-hidden className="graph-paper-dark absolute inset-0" />
      <div className="relative">
        <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">{title}</p>
        <ul className="mt-6 space-y-5">
          {items.map((item) => (
            <li key={item.title} className="flex gap-3">
              <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[3px] bg-signal-300" />
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ParticipantGate({
  children,
  eventHref = "/events",
  allowVisitors = false,
}: {
  children: React.ReactNode;
  eventHref?: string;
  /** Visitors may pass (e.g. creating a team registers them as a participant). */
  allowVisitors?: boolean;
}) {
  const [user, setUser] = useState<UserInfo | null | undefined>(undefined);

  useEffect(() => {
    fetchMeClient().then(setUser);
  }, []);

  if (user === undefined) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-ink" />
      </div>
    );
  }

  if (user?.role === "PARTICIPANT" || (allowVisitors && user?.role === "VISITOR")) {
    return <>{children}</>;
  }

  const isVisitor = Boolean(user);
  const isStaff = Boolean(user && user.role !== "VISITOR");

  return (
    <FormPageLayout
      eyebrow="Submission"
      title={isStaff ? "Participant area" : isVisitor ? "Become a participant first" : "Sign in required"}
      description={
        isStaff
          ? `You're signed in as ${user?.role.toLowerCase()}. Staff accounts can't join teams or submit projects.`
          : isVisitor
            ? "You're signed in, but visitors can't submit projects yet. Register for a hackathon to become a participant."
            : "Sign in as a participant to create or edit your team's hackathon submission."
      }
      aside={
        <GateAside
          title="What you need"
          items={[
            {
              title: "Participant account",
              body: "Register for an open hackathon or use the demo participant role.",
            },
            {
              title: "Join a team",
              body: "Create or join a team before submitting your project.",
            },
            {
              title: "Submit before deadline",
              body: "Save drafts and submit your final project before submissions close.",
            },
          ]}
        />
      }
    >
      <div className="space-y-6">
        <LockTile />
        <div className="flex flex-wrap gap-3">
          {isVisitor ? (
            <>
              <ButtonLink href={eventHref}>Register for a hackathon</ButtonLink>
              <ButtonLink
                href={loginHref("/participant", "participant")}
                variant="secondary"
              >
                Demo participant
              </ButtonLink>
            </>
          ) : (
            <>
              <ButtonLink href={loginHref("/participant", "participant")}>
                Sign in as participant
              </ButtonLink>
              <ButtonLink href="/register?redirect=/events" variant="secondary">
                Create account
              </ButtonLink>
            </>
          )}
        </div>
        {!isVisitor ? (
          <p className="text-sm text-zinc-500">
            Tip: use the{" "}
            <Link
              href="/login?redirect=/participant&mode=participant"
              className="font-semibold text-brand-600 underline-offset-4 hover:underline"
            >
              participant sign-in
            </Link>{" "}
            page for demo access.
          </p>
        ) : null}
      </div>
    </FormPageLayout>
  );
}

const ORGANIZER_ROLES = new Set(["ORGANIZER", "ADMIN"]);

export function OrganizerGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null | undefined>(undefined);

  useEffect(() => {
    fetchMeClient().then(setUser);
  }, []);

  if (user === undefined) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-ink" />
      </div>
    );
  }

  if (user && ORGANIZER_ROLES.has(user.role)) {
    return <>{children}</>;
  }

  return (
    <FormPageLayout
      eyebrow="Organizer"
      title="Organizer access required"
      description={
        user
          ? `You're signed in as ${user.role}. Only organizers and admins can manage events.`
          : "Sign in as an organizer to create or edit hackathon settings."
      }
      aside={
        <GateAside
          title="Organizer tools"
          items={[
            {
              title: "Event setup",
              body: "Configure hackathon name, tracks, prizes, and submission deadlines.",
            },
            {
              title: "Judging ops",
              body: "Monitor judge progress and export scoring results.",
            },
            {
              title: "Demo access",
              body: "Use the Organizer demo role on the login page for instant access.",
            },
          ]}
        />
      }
    >
      <div className="space-y-6">
        <LockTile />
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={loginHref("/organizer/dashboard", "organizer")}>
            Sign in as organizer
          </ButtonLink>
          <ButtonLink href="/events" variant="secondary">
            Back to events
          </ButtonLink>
        </div>
      </div>
    </FormPageLayout>
  );
}

/** Renders children only for ORGANIZER / ADMIN (e.g. Manage event buttons). */
export function OrganizerOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [user, setUser] = useState<UserInfo | null | undefined>(undefined);

  useEffect(() => {
    fetchMeClient().then(setUser);
  }, []);

  if (user === undefined) return null;
  if (user && ORGANIZER_ROLES.has(user.role)) return <>{children}</>;
  return <>{fallback}</>;
}

function LockTile() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-signal-300">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </div>
  );
}
