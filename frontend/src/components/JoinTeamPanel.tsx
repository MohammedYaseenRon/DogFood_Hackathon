"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
export function JoinTeamPanel({
  token,
  teamName,
}: {
  token: string;
  teamName: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function joinTeam() {
    setError(null);
    const res = await fetch(`/api/teams/join/${token}`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail ?? "Could not join team. Sign in as a participant first.");
      return;
    }
    setMessage(data.message ?? `Joined ${teamName}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Button onClick={joinTeam}>Join {teamName}</Button>
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
