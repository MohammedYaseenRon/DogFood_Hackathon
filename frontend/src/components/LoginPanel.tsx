"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CredentialAuthForm } from "@/components/CredentialAuthForm";
import { logoutClient } from "@/lib/api";
import { canAccess, safeRedirect } from "@/lib/role-auth";

type RoleCard = {
  id: string;
  label: string;
  role: string;
  desc: string;
  href: string;
  iconBg: string;
  badge: "brand" | "success" | "warning" | "default";
  sessionKey: string;
};

const PRIMARY_ROLES: RoleCard[] = [
  {
    id: "organizer",
    label: "Organizer",
    role: "ORGANIZER",
    desc: "Create events, monitor judging, and export results",
    href: "/organizer/dashboard",
    iconBg: "bg-zinc-900",
    badge: "default",
    sessionKey: "org_7f2a",
  },
  {
    id: "participant",
    label: "Participant",
    role: "PARTICIPANT",
    desc: "Join a team, submit projects, and edit until the deadline",
    href: "/participant",
    iconBg: "bg-amber-500",
    badge: "warning",
    sessionKey: "prt_2e88",
  },
  {
    id: "admin",
    label: "Admin",
    role: "ADMIN",
    desc: "Full platform access including event setup",
    href: "/admin",
    iconBg: "bg-zinc-700",
    badge: "default",
    sessionKey: "adm_3c91",
  },
];

const JUDGE_OPTIONS = [
  {
    label: "Judge A — Tomas Varga",
    sessionKey: "jdg_a_91bc",
    desc: "Primary judge account",
  },
  {
    label: "Judge B — peer isolation test",
    sessionKey: "jdg_b_44de",
    desc: "Used to verify score isolation",
  },
];

const ALL_SESSIONS = [
  ...PRIMARY_ROLES.map((r) => ({ label: r.label, key: r.sessionKey })),
  ...JUDGE_OPTIONS.map((j) => ({ label: j.label, key: j.sessionKey })),
];

export function LoginPanel({ redirectTo }: { redirectTo?: string }) {
  return (
    <div>
      <p className="mb-5 text-sm font-semibold text-zinc-800">
        Sign in with email
      </p>
      <CredentialAuthForm mode="login" redirectTo={redirectTo} />
    </div>
  );
}

export function LoginDemoRoles({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [showDevInfo, setShowDevInfo] = useState(false);
  const [judgeExpanded, setJudgeExpanded] = useState(false);

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
    setMessage(`Signed in as ${label}`);
    const role = data?.user?.role as string | undefined;
    const requested = safeRedirect(redirectTo, "");
    router.push(requested && canAccess(requested, role) ? requested : href);
    router.refresh();
  }

  async function logout() {
    await logoutClient();
    setMessage("Signed out");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <p className="text-xs font-bold tracking-[0.16em] text-zinc-400 uppercase">
          Demo access
        </p>
        <h2 className="font-display mt-1 text-xl font-semibold text-zinc-900">
          Pick a role to explore
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Instant sign-in with seeded accounts — no password needed.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PRIMARY_ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => login(role.sessionKey, role.label, role.href)}
            disabled={loading !== null}
            className="group flex items-start gap-3 rounded-xl border border-zinc-200 bg-canvas p-4 text-left transition hover:border-zinc-300 hover:bg-white hover:shadow-sm disabled:opacity-60"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${role.iconBg} text-sm font-bold text-white`}
            >
              {role.label.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-zinc-900">{role.label}</span>
                <Badge tone={role.badge}>{role.role}</Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {role.desc}
              </p>
            </div>
            <span className="mt-1 shrink-0 text-zinc-300 transition group-hover:text-zinc-700">
              {loading === role.sessionKey ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              ) : (
                "→"
              )}
            </span>
          </button>
        ))}

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-canvas sm:col-span-2">
          <button
            type="button"
            onClick={() => setJudgeExpanded((v) => !v)}
            className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-white"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
              J
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-zinc-900">Judge</span>
                <Badge tone="success">JUDGE</Badge>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Score assigned projects with backend-enforced isolation
              </p>
            </div>
            <ChevronIcon open={judgeExpanded} />
          </button>

          {judgeExpanded ? (
            <div className="border-t border-zinc-100 bg-white px-4 py-2">
              {JUDGE_OPTIONS.map((judge) => (
                <button
                  key={judge.sessionKey}
                  type="button"
                  onClick={() =>
                    login(judge.sessionKey, judge.label, "/judging")
                  }
                  disabled={loading !== null}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition hover:bg-zinc-50 disabled:opacity-60"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {judge.label}
                    </p>
                    <p className="text-xs text-zinc-500">{judge.desc}</p>
                  </div>
                  {loading === judge.sessionKey ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  ) : (
                    <span className="text-emerald-600">→</span>
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-5">
        <Button variant="secondary" onClick={logout} size="sm">
          Sign out
        </Button>
        <button
          type="button"
          onClick={() => setShowDevInfo((v) => !v)}
          className="text-xs font-medium text-zinc-400 transition hover:text-zinc-600"
        >
          {showDevInfo ? "Hide" : "Show"} developer info
        </button>
      </div>

      {showDevInfo ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Acceptance test sessions
          </p>
          <ul className="mt-3 space-y-1.5 font-mono text-xs text-zinc-600">
            {ALL_SESSIONS.map((s) => (
              <li key={s.key}>
                {s.label}: session={s.key}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {message ? (
        <div className="mt-4">
          <Alert tone="success">{message}</Alert>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`mt-1 shrink-0 text-zinc-400 transition ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
