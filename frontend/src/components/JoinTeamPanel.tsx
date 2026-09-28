"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchMeClient, joinTeamInviteClient } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";

export function JoinTeamPanel({
  token,
  teamName,
  teamId,
}: {
  token: string;
  teamName: string;
  teamId: string;
}) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMeClient().then((user) => setAuthenticated(Boolean(user)));
  }, []);

  const loginHref = `/login?redirect=${encodeURIComponent(`/join/${token}`)}`;

  async function joinTeam() {
    setError(null);
    setLoading(true);
    const result = await joinTeamInviteClient(token);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setMessage(result.message ?? `Joined ${teamName}`);
    router.push(`/teams/${result.teamId ?? teamId}`);
    router.refresh();
  }

  if (authenticated === null) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="space-y-4">
        <Alert tone="info">
          Sign in as a participant to join this team. You will return here after
          logging in.
        </Alert>
        <ButtonLink href={loginHref} className="w-full sm:w-auto">
          Sign in to join
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        You&apos;ve been invited to join <strong>{teamName}</strong>.
      </p>
      <Button onClick={joinTeam} disabled={loading} size="lg">
        {loading ? "Joining..." : "Join team"}
      </Button>
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
