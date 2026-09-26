"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const TEST_SESSIONS = [
  {
    label: "Organizer",
    key: "org_7f2a",
    role: "ORGANIZER",
    desc: "Manage event, export CSV, view progress",
    gradient: "from-violet-600 to-indigo-600",
    href: "/organizer/dashboard",
  },
  {
    label: "Judge A",
    key: "jdg_a_91bc",
    role: "JUDGE",
    desc: "Score assigned projects (Tomas Varga)",
    gradient: "from-emerald-500 to-teal-600",
    href: "/judging",
  },
  {
    label: "Judge B",
    key: "jdg_b_44de",
    role: "JUDGE",
    desc: "Peer isolation test account",
    gradient: "from-emerald-500 to-teal-600",
    href: "/judging",
  },
  {
    label: "Participant",
    key: "prt_2e88",
    role: "PARTICIPANT",
    desc: "Submit projects and join teams",
    gradient: "from-amber-500 to-orange-600",
    href: "/participant",
  },
];

export function LoginPanel() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function login(sessionKey: string, label: string, href: string) {
    setError(null);
    setLoading(sessionKey);
    const res = await fetch(
      `/api/auth/session?key=${encodeURIComponent(sessionKey)}`,
      { method: "POST", credentials: "include" },
    );
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(data.detail ?? "Login failed");
      return;
    }
    setMessage(`Signed in as ${label} (${data.user.role})`);
    router.push(href);
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
        These match the cookies in <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">.dogfood.toml</code> used by the acceptance checker.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        {TEST_SESSIONS.map((session) => (
          <button
            key={session.key}
            type="button"
            onClick={() => login(session.key, session.label, session.href)}
            disabled={loading === session.key}
            className="glow-card group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-violet-200 hover:shadow-lg disabled:opacity-60"
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${session.gradient} text-white shadow-md`}
              >
                {session.label.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-zinc-900">
                    {session.label}
                  </span>
                  <Badge tone="brand">{session.role}</Badge>
                </div>
                <p className="mt-1 text-sm text-zinc-500">{session.desc}</p>
                <p className="mt-2 font-mono text-xs text-zinc-400">
                  session={session.key}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Button variant="secondary" onClick={logout} className="w-full sm:w-auto">
        Sign out
      </Button>

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
