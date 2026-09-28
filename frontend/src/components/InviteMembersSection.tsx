"use client";

import { useState } from "react";
import { createTeamInviteClient, revokeTeamInviteClient, type TeamInviteInfo } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function InviteMembersSection({ teamId }: { teamId: string }) {
  const [invite, setInvite] = useState<TeamInviteInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function generateInvite() {
    setLoading(true);
    setError(null);
    setMessage(null);
    const { invite: created, error: createError } = await createTeamInviteClient(teamId, {
      expires_in_hours: 168,
      max_uses: 20,
    });
    setLoading(false);
    if (createError) {
      setError(createError);
      return;
    }
    setInvite(created);
    setMessage("Invite link generated. Share it with your teammates.");
  }

  async function copyLink() {
    if (!invite?.inviteUrl) return;
    await navigator.clipboard.writeText(invite.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function revokeInvite() {
    if (!invite?.token) return;
    setLoading(true);
    setError(null);
    const { ok, error: revokeError } = await revokeTeamInviteClient(invite.token);
    setLoading(false);
    if (!ok) {
      setError(revokeError);
      return;
    }
    setInvite(null);
    setMessage("Invite link revoked.");
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-zinc-950">Invite members</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Generate a secure link for teammates to join this team. Links expire after
            7 days and can be revoked anytime.
          </p>
        </div>
        <Button onClick={generateInvite} disabled={loading} size="sm">
          {loading ? "Working..." : "Generate invite link"}
        </Button>
      </div>

      {invite ? (
        <div className="mt-5 space-y-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
          <p className="text-xs font-semibold tracking-[0.16em] text-violet-600 uppercase">
            Active invite
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              readOnly
              value={invite.inviteUrl}
              className="w-full rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm text-zinc-800"
            />
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="secondary" onClick={copyLink}>
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Button type="button" variant="ghost" onClick={revokeInvite} disabled={loading}>
                Revoke
              </Button>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Expires {new Date(invite.expiresAt).toLocaleString()} ·{" "}
            {invite.remainingUses} uses remaining
          </p>
        </div>
      ) : null}

      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </Card>
  );
}
