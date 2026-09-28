"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMeClient, type UserInfo } from "@/lib/api";
import { ButtonLink } from "@/components/ui/Button";

/** Submit CTA that only shows for participants; others get a clear next step. */
export function SubmitProjectCta({
  size = "sm",
  className = "",
  label = "Submit project",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  const [user, setUser] = useState<UserInfo | null | undefined>(undefined);

  useEffect(() => {
    fetchMeClient().then(setUser);
  }, []);

  if (user === undefined) {
    return (
      <span
        className={`inline-flex h-10 w-32 animate-pulse rounded-xl bg-white/20 ${className}`}
      />
    );
  }

  if (user?.role === "PARTICIPANT") {
    return (
      <ButtonLink href="/projects/new" size={size} className={className}>
        {label}
      </ButtonLink>
    );
  }

  if (user) {
    return (
      <ButtonLink
        href="/events"
        size={size}
        variant="secondary"
        className={className}
      >
        Register for event to submit
      </ButtonLink>
    );
  }

  return (
    <ButtonLink
      href="/login?redirect=/events"
      size={size}
      className={className}
    >
      Sign in to submit
    </ButtonLink>
  );
}

export function ParticipantGate({
  children,
  eventHref = "/events",
}: {
  children: React.ReactNode;
  eventHref?: string;
}) {
  const [user, setUser] = useState<UserInfo | null | undefined>(undefined);

  useEffect(() => {
    fetchMeClient().then(setUser);
  }, []);

  if (user === undefined) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  if (user?.role === "PARTICIPANT") {
    return <>{children}</>;
  }

  const isVisitor = user?.role === "VISITOR" || Boolean(user);

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
        🔒
      </div>
      <h2 className="font-display mt-4 text-xl font-bold text-zinc-900">
        {isVisitor ? "Become a participant first" : "Sign in required"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
        {isVisitor
          ? "You're signed in, but visitors can't submit projects. Register for a hackathon to unlock participant access."
          : "Sign in as a participant (or create an account and register for an event) to submit a project."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {isVisitor ? (
          <>
            <ButtonLink href={eventHref}>Register for a hackathon</ButtonLink>
            <ButtonLink href="/login?redirect=/participant&mode=participant" variant="secondary">
              Switch to demo participant
            </ButtonLink>
          </>
        ) : (
          <>
            <ButtonLink href="/login?redirect=/participant&mode=participant">
              Sign in as participant
            </ButtonLink>
            <ButtonLink href="/register?redirect=/events" variant="secondary">
              Create account
            </ButtonLink>
          </>
        )}
      </div>
      {!isVisitor ? (
        <p className="mt-4 text-xs text-zinc-400">
          Tip: use the{" "}
          <Link href="/login?redirect=/participant&mode=participant" className="font-semibold text-zinc-900">
            participant sign-in
          </Link>{" "}
          page for demo access.
        </p>
      ) : null}
    </div>
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  if (user && ORGANIZER_ROLES.has(user.role)) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-2xl">
        🔒
      </div>
      <h2 className="font-display mt-4 text-xl font-bold text-zinc-900">
        Organizer access required
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
        {user
          ? `You're signed in as ${user.role}. Only organizers and admins can manage events.`
          : "Sign in as an organizer to create or edit hackathon settings."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/login?redirect=/organizer/dashboard">
          Sign in as organizer
        </ButtonLink>
        <ButtonLink href="/events" variant="secondary">
          Back to events
        </ButtonLink>
      </div>
    </div>
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

