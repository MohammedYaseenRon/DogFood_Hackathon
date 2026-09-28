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
}: {
  mode: Mode;
  redirectTo?: string;
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

    router.push(redirectTo || "/participant");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100";

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
              href={`/register${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
              className="font-semibold text-[#3770FF] hover:text-blue-700"
            >
              Register
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href={`/login${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
              className="font-semibold text-[#3770FF] hover:text-blue-700"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
