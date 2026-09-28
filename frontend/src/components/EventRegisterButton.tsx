"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  fetchMeClient,
  fetchMyRegistrationClient,
  registerForEventClient,
  type EventInfo,
} from "@/lib/api";

export function EventRegisterButton({ event }: { event: EventInfo }) {
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

  const phase = event.state?.phase ?? "UPCOMING";
  const registrationOpen = phase === "REGISTRATION_OPEN";

  useEffect(() => {
    Promise.all([fetchMeClient(), fetchMyRegistrationClient()]).then(
      ([user, reg]) => {
        setAuthed(Boolean(user));
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
        : "Registration confirmed. You can create or join a team next.",
    );
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Checking registration...</p>;
  }

  if (registered) {
    return (
      <Alert tone="success" title="Registered">
        You are registered for this hackathon. Head to your participant dashboard
        to form a team and submit a project.
      </Alert>
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
    return (
      <div className="space-y-3">
        <Alert tone="info" title="Registration open">
          Sign in or create an account to register for this hackathon.
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => {
              window.location.href = `/login?redirect=${encodeURIComponent("/event")}`;
            }}
          >
            Sign in to register
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              window.location.href = `/register?redirect=${encodeURIComponent("/event")}`;
            }}
          >
            Create account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Alert tone="success" title="Registration open">
        Join the hackathon to create a team and submit your project.
      </Alert>
      <Button type="button" onClick={register} disabled={submitting}>
        {submitting ? "Registering..." : "Register now"}
      </Button>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
    </div>
  );
}
