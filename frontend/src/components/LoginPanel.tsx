"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type RoleCard = {
  id: string;
  label: string;
  role: string;
  desc: string;
  href: string;
  gradient: string;
  border: string;
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
    gradient: "from-violet-600 to-indigo-600",
    border: "hover:border-violet-300",
    badge: "brand",
    sessionKey: "org_7f2a",
  },
  {
    id: "participant",
    label: "Participant",
    role: "PARTICIPANT",
    desc: "Join a team, submit projects, and edit until the deadline",
    href: "/participant",
    gradient: "from-amber-500 to-orange-600",
    border: "hover:border-amber-300",
    badge: "warning",
    sessionKey: "prt_2e88",
  },
  {
    id: "admin",
    label: "Admin",
    role: "ADMIN",
    desc: "Full platform access including event setup",
    href: "/organizer/dashboard",
    gradient: "from-zinc-700 to-zinc-900",
    border: "hover:border-zinc-400",
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
    router.push(redirectTo || href);
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setMessage("Signed out");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {PRIMARY_ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => login(role.sessionKey, role.label, role.href)}
            disabled={loading !== null}
            className={`group flex w-full items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md ${role.border} disabled:opacity-60`}
          >
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${role.gradient} text-xl font-bold text-white shadow-md transition group-hover:scale-105`}
            >
              {role.label.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-bold text-zinc-900">
                  {role.label}
                </span>
                <Badge tone={role.badge}>{role.role}</Badge>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{role.desc}</p>
            </div>
            <span className="shrink-0 text-zinc-300 transition group-hover:text-[#3770FF]">
              {loading === role.sessionKey ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#3770FF] border-t-transparent" />
              ) : (
                <ArrowIcon />
              )}
            </span>
          </button>
        ))}

        {/* Judge — expandable */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setJudgeExpanded((v) => !v)}
            className="group flex w-full items-center gap-4 p-5 text-left transition hover:bg-zinc-50"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xl font-bold text-white shadow-md">
              J
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-bold text-zinc-900">
                  Judge
                </span>
                <Badge tone="success">JUDGE</Badge>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                Score assigned projects with backend-enforced isolation
              </p>
            </div>
            <ChevronIcon open={judgeExpanded} />
          </button>

          {judgeExpanded ? (
            <div className="border-t border-zinc-100 bg-zinc-50/50 px-5 py-3">
              {JUDGE_OPTIONS.map((judge) => (
                <button
                  key={judge.sessionKey}
                  type="button"
                  onClick={() =>
                    login(judge.sessionKey, judge.label, "/judging")
                  }
                  disabled={loading !== null}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-white disabled:opacity-60"
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
                    <ArrowIcon className="text-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
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
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Acceptance test sessions
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            These cookies match <code className="text-zinc-700">.dogfood.toml</code>{" "}
            used by the automated checker.
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

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-zinc-400 transition ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
