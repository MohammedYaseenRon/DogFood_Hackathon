"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const TEST_SESSIONS = [
  {
    label: "Organizer",
    key: "org_7f2a",
    role: "ORGANIZER",
    desc: "Manage event, export CSV, view progress",
  },
  {
    label: "Judge A",
    key: "jdg_a_91bc",
    role: "JUDGE",
    desc: "Score assigned projects (Tomas Varga)",
  },
  {
    label: "Judge B",
    key: "jdg_b_44de",
    role: "JUDGE",
    desc: "Peer isolation test account",
  },
  {
    label: "Participant",
    key: "prt_2e88",
    role: "PARTICIPANT",
    desc: "Submit projects and join teams",
  },
];

export function LoginPanel() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function login(sessionKey: string, label: string) {
    setError(null);
    const res = await fetch(
      `/api/auth/session?key=${encodeURIComponent(sessionKey)}`,
      { method: "POST", credentials: "include" },
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail ?? "Login failed");
      return;
    }
    setMessage(`Signed in as ${label} (${data.user.role})`);
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setMessage("Signed out");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Alert tone="info" title="Demo sessions">
        These match the cookies in <code>.dogfood.toml</code> used by the
        acceptance checker.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        {TEST_SESSIONS.map((session) => (
          <Card
            key={session.key}
            className="cursor-pointer transition hover:border-indigo-300 hover:shadow-md"
          >
            <button
              type="button"
              onClick={() => login(session.key, session.label)}
              className="w-full text-left"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-slate-900">
                  {session.label}
                </span>
                <Badge tone="brand">{session.role}</Badge>
              </div>
              <p className="text-sm text-slate-600">{session.desc}</p>
              <p className="mt-3 font-mono text-xs text-slate-400">
                session={session.key}
              </p>
            </button>
          </Card>
        ))}
      </div>

      <Button variant="secondary" onClick={logout}>
        Sign out
      </Button>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
