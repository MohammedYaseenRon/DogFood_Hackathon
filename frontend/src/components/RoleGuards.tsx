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

function GateAside({
  title,
  items,
}: {
  title: string;
  items: { title: string; body: string }[];
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold tracking-[0.16em] text-zinc-400 uppercase">
        {title}
      </p>
      <div className="mt-6 grid gap-4">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-zinc-100 bg-[#fafafa] p-4"
          >
            <p className="font-semibold text-zinc-900">{item.title}</p>
            <p className="mt-1 text-sm text-zinc-500">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
      </div>
    );
  }

  if (user?.role === "PARTICIPANT") {
    return <>{children}</>;
  }

  const isVisitor = user?.role === "VISITOR" || Boolean(user);

  return (
    <FormPageLayout
      eyebrow="Submission"
      title={isVisitor ? "Become a participant first" : "Sign in required"}
      description={
        isVisitor
          ? "You're signed in, but visitors can't submit projects. Register for a hackathon to unlock participant access."
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
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-xl">
          🔒
        </div>
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
              className="font-semibold text-zinc-900 hover:underline"
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
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
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-xl">
          🔒
        </div>
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
