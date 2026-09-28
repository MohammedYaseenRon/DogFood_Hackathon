"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Eyebrow } from "@/components/ui/MarkedTitle";
import { CredentialAuthForm } from "@/components/CredentialAuthForm";
import {
  ROLE_AUTH,
  registerHref,
  safeRedirect,
  type RoleMode,
} from "@/lib/role-auth";

export function RoleSignInPanel({
  roleMode,
  redirectTo,
  embedded = false,
  showEmail = true,
}: {
  roleMode: RoleMode;
  redirectTo?: string;
  embedded?: boolean;
  showEmail?: boolean;
}) {
  const router = useRouter();
  const config = ROLE_AUTH[roleMode];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const target = safeRedirect(redirectTo, config.defaultRedirect);

  async function demoLogin() {
    setError(null);
    setLoading(true);
    const res = await fetch(
      `/api/auth/session?key=${encodeURIComponent(config.sessionKey)}`,
      { method: "POST", credentials: "include" },
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.detail ?? "Demo login failed");
      return;
    }
    setMessage(`Signed in as ${config.label}`);
    router.push(target);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {showEmail ? (
        <>
          <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
            Sign in with email
          </p>
          <CredentialAuthForm mode="login" redirectTo={target} expectedRole={config.role} />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 font-mono text-[11px] tracking-[0.14em] text-zinc-400 uppercase">
                Or demo access
              </span>
            </div>
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => void demoLogin()}
        disabled={loading}
        className={`group flex w-full items-center gap-4 rounded-xl border border-line bg-canvas p-4 text-left transition disabled:opacity-60 ${config.hoverBorder}`}
      >
        <div
          className={`font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${config.iconBg} text-sm font-semibold text-white`}
        >
          {config.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">Demo {config.label.toLowerCase()}</p>
          <p className="text-sm text-zinc-500">{config.description}</p>
        </div>
        <span className="text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-ink">
          {loading ? "…" : "→"}
        </span>
      </button>

      {!embedded && roleMode === "participant" ? (
        <p className="text-center text-sm text-zinc-500">
          New here?{" "}
          <Link
            href={registerHref("/events", "participant")}
            className="font-semibold text-brand-600 underline-offset-4 hover:underline"
          >
            Create account
          </Link>
          , then register for a hackathon.
        </p>
      ) : null}

      {!embedded && roleMode !== "participant" ? (
        <p className="text-center text-sm text-zinc-500">
          Email accounts start as visitors. Use the demo button above for{" "}
          {config.label.toLowerCase()} tools, or{" "}
          <Link
            href="/login"
            className="font-semibold text-brand-600 underline-offset-4 hover:underline"
          >
            see all sign-in options
          </Link>
          .
        </p>
      ) : null}

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}

/** Demo sign-in tiles for the register page; rendered inside the ink aside. */
export function RegisterDemoRoles({
  redirectTo,
  selectedMode,
}: {
  redirectTo?: string;
  selectedMode?: RoleMode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function demoLogin(mode: RoleMode) {
    const config = ROLE_AUTH[mode];
    setError(null);
    setLoading(mode);
    const res = await fetch(
      `/api/auth/session?key=${encodeURIComponent(config.sessionKey)}`,
      { method: "POST", credentials: "include" },
    );
    const data = await res.json();
    setLoading(null);
    if (!res.ok) {
      setError(data.detail ?? "Demo login failed");
      return;
    }
    router.push(safeRedirect(redirectTo, config.defaultRedirect));
    router.refresh();
  }

  const modes = (Object.keys(ROLE_AUTH) as RoleMode[]).filter(
    (mode) => !selectedMode || mode === selectedMode,
  );

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <Eyebrow dark>Demo access</Eyebrow>
        <h2 className="font-display mt-5 text-2xl leading-tight font-semibold">
          Or skip the <span className="hl hl-solid">form</span>
        </h2>
        <p className="mt-3 text-sm text-white/65">
          Explore instantly with a seeded account for any role.
        </p>
      </div>
      <div className="grid gap-3">
        {modes.map((mode) => {
          const config = ROLE_AUTH[mode];
          return (
            <button
              key={mode}
              type="button"
              onClick={() => void demoLogin(mode)}
              disabled={loading !== null}
              className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-white/25 hover:bg-white/[0.08] disabled:opacity-60"
            >
              <div
                className={`font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.iconBg === "bg-ink" ? "bg-white/10" : config.iconBg} text-sm font-semibold text-white ring-1 ring-white/15 ring-inset`}
              >
                {config.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{config.label}</p>
                <p className="mt-0.5 text-xs text-white/60">{config.description}</p>
              </div>
              <span className="mt-1 text-white/30 transition group-hover:text-signal-300">
                {loading === mode ? "…" : "→"}
              </span>
            </button>
          );
        })}
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
