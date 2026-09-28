"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchMeClient, joinTeamInviteClient, type UserInfo } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { loginHref, registerHref } from "@/lib/role-auth";

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
  const [user, setUser] = useState<UserInfo | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMeClient().then(setUser);
  }, []);

  const here = `/join/${token}`;

  async function joinTeam() {
    setError(null);
    setLoading(true);
    const result = await joinTeamInviteClient(token);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.push(`/teams/${result.teamId ?? teamId}`);
    router.refresh();
  }

  if (user === undefined) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Alert tone="info">
          Sign in or create an account to join <strong>{teamName}</strong>. You&apos;ll come back
          here afterwards.
        </Alert>
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
      <Alert tone="warning" title={`Signed in as ${user.role.toLowerCase()}`}>
        Staff accounts can&apos;t join participant teams. Sign in with a participant account to
        accept this invite.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Joining as <strong>{user.name || user.email}</strong>. Joining also registers you for the
        event.
      </p>
      <Button onClick={joinTeam} disabled={loading} size="lg">
        {loading ? "Joining..." : `Join ${teamName}`}
      </Button>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
