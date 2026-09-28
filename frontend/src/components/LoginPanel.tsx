"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/MarkedTitle";
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
  sessionKey: string;
};

const PRIMARY_ROLES: RoleCard[] = [
  {
    id: "organizer",
    label: "Organizer",
    role: "ORGANIZER",
    desc: "Create events, monitor judging, and export results",
    href: "/organizer/dashboard",
    iconBg: "bg-white/10",
    sessionKey: "org_7f2a",
  },
  {
    id: "participant",
    label: "Participant",
    role: "PARTICIPANT",
    desc: "Join a team, submit projects, and edit until the deadline",
    href: "/participant",
    iconBg: "bg-brand-600",
    sessionKey: "prt_2e88",
  },
  {
    id: "admin",
    label: "Admin",
    role: "ADMIN",
    desc: "Full platform access including event setup",
    href: "/admin",
    iconBg: "bg-zinc-600",
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
      <p className="mb-5 font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
        Sign in with email
      </p>
      <CredentialAuthForm mode="login" redirectTo={redirectTo} />
    </div>
  );
}

/** Demo sign-in tiles; rendered inside the ink aside of AuthPageLayout. */
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

  const tile =
    "group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-60";

  return (
    <>
      <div className="mb-6">
        <Eyebrow dark>Demo access</Eyebrow>
        <h2 className="font-display mt-5 text-2xl leading-tight font-semibold">
          Pick a role to <span className="hl hl-solid">explore</span>
        </h2>
        <p className="mt-3 text-sm text-white/65">
          Instant sign-in with seeded accounts. No password needed.
        </p>
      </div>

      <div className="grid gap-3">
        {PRIMARY_ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => login(role.sessionKey, role.label, role.href)}
            disabled={loading !== null}
            className={tile}
          >
            <RoleGlyph letter={role.label.charAt(0)} className={role.iconBg} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{role.label}</span>
                <span className="font-mono text-[10px] tracking-widest text-white/40">
                  {role.role}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/60">{role.desc}</p>
            </div>
            <span className="mt-1 shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-signal-300">
              {loading === role.sessionKey ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
              ) : (
                "→"
              )}
            </span>
          </button>
        ))}

        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
          <button
            type="button"
            onClick={() => setJudgeExpanded((v) => !v)}
            aria-expanded={judgeExpanded}
            className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-white/[0.08]"
          >
            <RoleGlyph letter="J" className="bg-emerald-600" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Judge</span>
                <span className="font-mono text-[10px] tracking-widest text-white/40">JUDGE</span>
              </div>
              <p className="mt-1 text-xs text-white/60">
                Score assigned projects with backend-enforced isolation
              </p>
            </div>
            <ChevronIcon open={judgeExpanded} />
          </button>

          {judgeExpanded ? (
            <div className="border-t border-white/10 px-2 py-2">
              {JUDGE_OPTIONS.map((judge) => (
                <button
                  key={judge.sessionKey}
                  type="button"
                  onClick={() => login(judge.sessionKey, judge.label, "/judging")}
                  disabled={loading !== null}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition hover:bg-white/[0.08] disabled:opacity-60"
                >
                  <div>
                    <p className="text-sm font-semibold">{judge.label}</p>
                    <p className="text-xs text-white/55">{judge.desc}</p>
                  </div>
                  {loading === judge.sessionKey ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                  ) : (
                    <span className="text-emerald-400">→</span>
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
        <Button variant="outline" onClick={logout} size="sm">
          Sign out
        </Button>
        <button
          type="button"
          onClick={() => setShowDevInfo((v) => !v)}
          className="font-mono text-[11px] tracking-wide text-white/45 uppercase transition hover:text-white/80"
        >
          {showDevInfo ? "Hide" : "Show"} developer info
        </button>
      </div>

      {showDevInfo ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="font-mono text-[11px] tracking-widest text-white/50 uppercase">
            Acceptance test sessions
          </p>
          <ul className="mt-3 space-y-1.5 font-mono text-xs text-white/75">
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
    </>
  );
}

function RoleGlyph({ letter, className }: { letter: string; className: string }) {
  return (
    <div
      className={`font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white ring-1 ring-white/15 ring-inset ${className}`}
    >
      {letter}
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
      className={`mt-1 shrink-0 text-white/40 transition ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
