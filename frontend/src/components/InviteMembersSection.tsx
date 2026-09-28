"use client";

import { useEffect, useState } from "react";
import {
  createTeamInviteClient,
  fetchTeamInvitesClient,
  revokeTeamInviteClient,
  type TeamInviteInfo,
} from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";

const EXPIRY_OPTIONS = [
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
  { hours: 720, label: "30 days" },
];

export function InviteMembersSection({ teamId }: { teamId: string }) {
  const [invites, setInvites] = useState<TeamInviteInfo[]>([]);
  const [expiresIn, setExpiresIn] = useState(168);
  const [maxUses, setMaxUses] = useState(3);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchTeamInvitesClient(teamId).then((list) => {
      if (active) setInvites(list);
    });
    return () => {
      active = false;
    };
  }, [teamId]);

  async function generateInvite() {
    setLoading(true);
    setError(null);
    const { invite, error: createError } = await createTeamInviteClient(teamId, {
      expires_in_hours: expiresIn,
      max_uses: maxUses,
    });
    setLoading(false);
    if (createError || !invite) {
      setError(createError ?? "Could not create an invite.");
      return;
    }
    setInvites((prev) => [invite, ...prev]);
  }

  async function copyLink(invite: TeamInviteInfo) {
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      setCopied(invite.token);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Couldn't access the clipboard — copy the link manually.");
    }
  }

  async function revoke(invite: TeamInviteInfo) {
    setLoading(true);
    setError(null);
    const { ok, error: revokeError } = await revokeTeamInviteClient(invite.token);
    setLoading(false);
    if (!ok) {
      setError(revokeError);
      return;
    }
    setInvites((prev) => prev.filter((item) => item.token !== invite.token));
  }

  return (
    <Card>
      <h3 className="font-display text-lg font-semibold text-ink">Invite teammates</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Anyone with the link can join until it expires, runs out of uses, or you revoke it.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="invite-expiry" className="mb-1.5 block text-xs font-semibold text-zinc-500">
            Expires after
          </label>
          <select
            id="invite-expiry"
            value={expiresIn}
            onChange={(e) => setExpiresIn(Number(e.target.value))}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.hours} value={option.hours}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="invite-uses" className="mb-1.5 block text-xs font-semibold text-zinc-500">
            Max uses
          </label>
          <input
            id="invite-uses"
            type="number"
            min={1}
            max={50}
            value={maxUses}
            onChange={(e) => setMaxUses(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="w-24 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        <Button onClick={generateInvite} disabled={loading} size="sm">
          {loading ? "Working…" : "Create invite link"}
        </Button>
      </div>

      {invites.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {invites.map((invite) => (
            <li key={invite.token} className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  readOnly
                  aria-label="Invite link"
                  value={invite.inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm text-zinc-800"
                />
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => void copyLink(invite)}>
                    {copied === invite.token ? "Copied" : "Copy"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void revoke(invite)} disabled={loading}>
                    Revoke
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Expires {formatDateTime(invite.expiresAt)} · {invite.remainingUses} of {invite.maxUses} uses left
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-zinc-400">No active invite links.</p>
      )}

      {error ? (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
    </Card>
  );
}
