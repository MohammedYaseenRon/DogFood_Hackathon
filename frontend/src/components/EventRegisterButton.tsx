"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  fetchMeClient,
  fetchMyRegistrationClient,
  registerForEventClient,
  type EventInfo,
  type UserInfo,
} from "@/lib/api";

export function EventRegisterButton({ event }: { event: EventInfo }) {
  const router = useRouter();
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);

  const registrationOpen =
    event.state?.registrationOpen ?? event.state?.phase === "REGISTRATION_OPEN";
  const authed = Boolean(user);
  const canRegisterRole =
    !user || user.role === "VISITOR" || user.role === "PARTICIPANT";

  useEffect(() => {
    Promise.all([fetchMeClient(), fetchMyRegistrationClient()]).then(
      ([me, reg]) => {
        setUser(me);
        setRegistered(Boolean(reg?.registered));
        setLoading(false);
      },
    );
  }, []);

  async function register() {
    setError(null);
    setMessage(null);
    setSubmitting(true);
    const result = await registerForEventClient();
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRegistered(true);
    setMessage(
      result.alreadyRegistered
        ? "You are already registered for this event."
        : "You're now a participant! Redirecting to your hub…",
    );
    const me = await fetchMeClient();
    setUser(me);
    window.setTimeout(() => {
      router.push("/participant");
      router.refresh();
    }, 700);
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Checking registration...</p>;
  }

  if (registered || user?.role === "PARTICIPANT") {
    return (
      <div className="space-y-3">
        <Alert tone="success" title="You're in">
          Registered as a participant. Create a team and submit your project from
          the hub.
        </Alert>
        <ButtonLink href="/participant">Go to participant hub</ButtonLink>
      </div>
    );
  }

  if (!registrationOpen) {
    return (
      <Alert tone="warning" title="Registration closed">
        Registration is not currently open for this event.
      </Alert>
    );
  }

  if (!authed) {
    const redirect = `/events/${event.slug || event.id}`;
    return (
      <div className="space-y-3">
        <Alert tone="info" title="Registration open">
          Create an account or sign in, then register for this hackathon to become
          a participant.
        </Alert>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/register?redirect=${encodeURIComponent(redirect)}`}>
            Create account
          </ButtonLink>
          <ButtonLink
            href={`/login?redirect=${encodeURIComponent(redirect)}`}
            variant="secondary"
          >
            Sign in
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (!canRegisterRole) {
    return (
      <Alert tone="warning" title="Wrong role">
        You&apos;re signed in as {user?.role}. Switch to a Visitor/Participant
        account or use the Participant demo on the login page.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <Alert tone="success" title="Registration open">
        One click and you&apos;ll become a participant for this hackathon.
      </Alert>
      <Button type="button" onClick={register} disabled={submitting} size="lg">
        {submitting ? "Registering..." : "Register as participant"}
      </Button>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
    </div>
  );
}
