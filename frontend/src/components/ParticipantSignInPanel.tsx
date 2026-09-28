"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { CredentialAuthForm } from "@/components/CredentialAuthForm";

const PARTICIPANT_SESSION = "prt_2e88";

export function ParticipantSignInPanel({
  embedded = false,
  redirectTo = "/participant",
}: {
  embedded?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function demoLogin() {
    setError(null);
    setLoading(true);
    const res = await fetch(
      `/api/auth/session?key=${encodeURIComponent(PARTICIPANT_SESSION)}`,
      { method: "POST", credentials: "include" },
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.detail ?? "Demo login failed");
      return;
    }
    setMessage("Signed in as Participant");
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className={embedded ? "space-y-5" : "space-y-6"}>
      {!embedded ? (
        <div className="text-center">
          <Badge tone="warning">Participant</Badge>
          <p className="mt-3 text-sm text-zinc-500">
            Sign in with your account or use the demo participant to access teams
            and submissions.
          </p>
        </div>
      ) : null}

      <CredentialAuthForm mode="login" redirectTo={redirectTo} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3 text-zinc-400">Or demo access</span>
        </div>
      </div>

      <button
        type="button"
        onClick={demoLogin}
        disabled={loading}
        className="group flex w-full items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-orange-200 hover:bg-orange-50/50 disabled:opacity-60"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-lg font-bold text-white">
          P
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-900">Demo participant</p>
          <p className="text-sm text-zinc-500">
            Instant access with a pre-seeded team
          </p>
        </div>
        <span className="text-zinc-400 group-hover:text-orange-600">→</span>
      </button>

      <p className="text-center text-sm text-zinc-500">
        New here?{" "}
        <Link
          href={`/register?redirect=${encodeURIComponent("/events")}`}
          className="font-semibold text-zinc-900 hover:underline"
        >
          Create account
        </Link>
        , then register for a hackathon to become a participant.
      </p>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
