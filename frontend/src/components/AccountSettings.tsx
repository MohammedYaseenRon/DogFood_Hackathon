"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  changePasswordClient,
  fetchMeClient,
  updateProfileClient,
  type UserInfo,
} from "@/lib/api";
import { homeForRole, loginHref } from "@/lib/role-auth";

const inputClass = "field";

export function AccountSettings() {
  const [user, setUser] = useState<UserInfo | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [profileMsg, setProfileMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    fetchMeClient().then((me) => {
      setUser(me);
      setName(me?.name ?? "");
    });
  }, []);

  if (user === undefined) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card variant="elevated" className="mx-auto max-w-lg text-center">
        <p className="font-display text-lg font-semibold text-ink">Sign in to manage your account</p>
        <ButtonLink href={loginHref("/account")} className="mt-5">
          Sign in
        </ButtonLink>
      </Card>
    );
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setSavingProfile(true);
    const result = await updateProfileClient(name.trim());
    setSavingProfile(false);
    if (result.error || !result.data) {
      setProfileMsg({ tone: "error", text: result.error ?? "Could not save" });
      return;
    }
    setUser(result.data);
    setProfileMsg({ tone: "success", text: "Profile updated." });
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (next.length < 8) {
      setPwMsg({ tone: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setPwMsg({ tone: "error", text: "New passwords don't match." });
      return;
    }
    setSavingPw(true);
    const result = await changePasswordClient(current || null, next);
    setSavingPw(false);
    if (result.error) {
      setPwMsg({ tone: "error", text: result.error });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setPwMsg({ tone: "success", text: "Password changed. Other sessions were signed out." });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Card variant="elevated">
          <SectionHead title="Profile" hint="How you appear to teammates and judges." />
          <form onSubmit={saveProfile} className="mt-5 space-y-4">
            <div>
              <label htmlFor="account-name" className="field-label">
                Display name
              </label>
              <input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
                className={inputClass}
              />
              <p className="mt-2 text-xs text-zinc-400">Shown to teammates and on your project page.</p>
            </div>
            <div>
              <label className="field-label">Email</label>
              <input value={user.email} disabled className={inputClass} />
            </div>
            <Button type="submit" disabled={savingProfile || !name.trim()}>
              {savingProfile ? "Saving..." : "Save profile"}
            </Button>
            {profileMsg ? <Alert tone={profileMsg.tone}>{profileMsg.text}</Alert> : null}
          </form>
        </Card>

        <Card variant="elevated">
          <SectionHead title="Password" hint="Changing it signs out your other sessions." />
          <form onSubmit={savePassword} className="mt-5 space-y-4">
            <div>
              <label htmlFor="pw-current" className="field-label">
                Current password
              </label>
              <input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={inputClass}
                placeholder="Leave empty if you signed in with a demo role"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pw-new" className="field-label">
                  New password
                </label>
                <input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="pw-confirm" className="field-label">
                  Confirm new password
                </label>
                <input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <Button type="submit" disabled={savingPw}>
              {savingPw ? "Updating..." : "Change password"}
            </Button>
            {pwMsg ? <Alert tone={pwMsg.tone}>{pwMsg.text}</Alert> : null}
          </form>
        </Card>
      </div>

      <aside className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white lg:sticky lg:top-24">
          <div aria-hidden className="graph-paper-dark absolute inset-0" />
          <div className="relative">
            <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">Signed in as</p>
            <div className="mt-5 flex items-center gap-4">
              <span className="font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-signal-300 text-xl font-semibold text-ink">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="font-display truncate text-lg font-semibold">{user.name || user.email}</p>
                <p className="truncate text-sm text-white/60">{user.email}</p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-dashed border-white/15 pt-4">
              <span className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">Role</span>
              <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] tracking-wide text-signal-300 uppercase">
                {user.role}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/65">
              {user.role === "VISITOR"
                ? "Register for an event to become a participant."
                : "Roles are assigned by platform admins."}
            </p>
            <ButtonLink href={homeForRole(user.role)} variant="signal" size="sm" className="mt-5">
              Go to dashboard →
            </ButtonLink>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="border-b border-line pb-4">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{hint}</p>
    </div>
  );
}
