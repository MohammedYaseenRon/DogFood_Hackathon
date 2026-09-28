"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type Mode = "login" | "register";

export function CredentialAuthForm({
  mode,
  redirectTo,
  expectedRole,
  roleMode,
}: {
  mode: Mode;
  redirectTo?: string;
  /** When set, email login must match this role or show an error. */
  expectedRole?: string;
  roleMode?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body =
      mode === "login"
        ? { email, password }
        : { email, password, name: name.trim() || email.split("@")[0] };

    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setError(typeof data?.detail === "string" ? data.detail : "Request failed");
      return;
    }

    const role = data?.user?.role as string | undefined;

    if (expectedRole && role && role !== expectedRole) {
      setError(
        `Your account is a ${role}. Email login cannot switch roles — use the demo ${expectedRole.toLowerCase()} button instead.`,
      );
      return;
    }

    let next = redirectTo;
    if (next === "/participant" && role && role !== "PARTICIPANT") {
      next = "/events";
    }
    if (next === "/projects/new" && role && role !== "PARTICIPANT") {
      next = "/events";
    }
    if (next?.startsWith("/organizer") && role && role !== "ORGANIZER" && role !== "ADMIN") {
      next = "/events";
    }
    if (next?.startsWith("/judging") && role && role !== "JUDGE") {
      next = "/events";
    }
    if (next?.startsWith("/admin") && role && role !== "ADMIN") {
      next = "/events";
    }

    const fallback =
      role === "PARTICIPANT"
        ? "/participant"
        : role === "ORGANIZER" || role === "ADMIN"
          ? "/organizer/dashboard"
          : role === "JUDGE"
            ? "/judging"
            : "/events";

    router.push(next || fallback);
    router.refresh();
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100";

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "register" ? (
        <div>
          <label className="mb-2 block text-sm font-semibold text-zinc-700">
            Full name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Jane Doe"
            required
          />
        </div>
      ) : null}

      <div>
        <label className="mb-2 block text-sm font-semibold text-zinc-700">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-zinc-700">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
          minLength={mode === "register" ? 8 : 1}
          required
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full" size="lg">
        {loading
          ? "Please wait..."
          : mode === "login"
            ? "Sign in with email"
            : "Create account"}
      </Button>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <p className="text-center text-sm text-zinc-500">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link
              href={`/register${buildAuthQuery(redirectTo, roleMode)}`}
              className="font-semibold text-zinc-900 hover:underline"
            >
              Register
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href={`/login${buildAuthQuery(redirectTo, roleMode)}`}
              className="font-semibold text-zinc-900 hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

function buildAuthQuery(redirectTo?: string, roleMode?: string) {
  const params = new URLSearchParams();
  if (redirectTo) params.set("redirect", redirectTo);
  if (roleMode) params.set("mode", roleMode);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
