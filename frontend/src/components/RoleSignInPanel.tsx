"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
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
          <p className="text-sm font-semibold text-zinc-800">Sign in with email</p>
          <CredentialAuthForm
            mode="login"
            redirectTo={target}
            expectedRole={config.role}
          />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-zinc-400">Or demo access</span>
            </div>
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => void demoLogin()}
        disabled={loading}
        className={`group flex w-full items-center gap-4 rounded-xl border border-zinc-200 bg-canvas p-4 text-left transition disabled:opacity-60 ${config.hoverBorder}`}
      >
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${config.iconBg} text-sm font-bold text-white`}
        >
          {config.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-900">Demo {config.label.toLowerCase()}</p>
          <p className="text-sm text-zinc-500">{config.description}</p>
        </div>
        <span className="text-zinc-400 group-hover:text-zinc-700">
          {loading ? "…" : "→"}
        </span>
      </button>

      {!embedded && roleMode === "participant" ? (
        <p className="text-center text-sm text-zinc-500">
          New here?{" "}
          <Link
            href={registerHref("/events", "participant")}
            className="font-semibold text-zinc-900 hover:underline"
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
          <Link href="/login" className="font-semibold text-zinc-900 hover:underline">
            full login
          </Link>
          .
        </p>
      ) : null}

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}

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
      <div>
        <p className="text-xs font-bold tracking-[0.16em] text-zinc-400 uppercase">
          Demo access
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Skip registration and explore instantly with a seeded role.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {modes.map((mode) => {
          const config = ROLE_AUTH[mode];
          return (
            <button
              key={mode}
              type="button"
              onClick={() => void demoLogin(mode)}
              disabled={loading !== null}
              className={`flex items-start gap-3 rounded-xl border border-zinc-200 bg-canvas p-4 text-left transition disabled:opacity-60 ${config.hoverBorder}`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.iconBg} text-sm font-bold text-white`}
              >
                {config.icon}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900">{config.label}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{config.description}</p>
              </div>
            </button>
          );
        })}
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
