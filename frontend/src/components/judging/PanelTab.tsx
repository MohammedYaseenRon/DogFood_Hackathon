"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createJudgeInviteClient,
  fetchJudgePanelClient,
  removeJudgeClient,
  revokeJudgeInviteClient,
  seatJudgeClient,
  updateJudgeScopeClient,
  type JudgeInviteInfo,
  type OrganizerJudgeProgress,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Panel, Spinner, StatusChip, TrackPicker } from "@/components/judging/shared";

type Track = { id: string; name: string };
type Notice = { tone: "success" | "error"; text: string } | null;

export function PanelTab({ slug, tracks, onChange }: { slug: string; tracks: Track[]; onChange: () => void }) {
  const [judges, setJudges] = useState<OrganizerJudgeProgress[] | null>(null);
  const [invites, setInvites] = useState<JudgeInviteInfo[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [scopeDraft, setScopeDraft] = useState<string[]>([]);

  const load = useCallback(
    () =>
      fetchJudgePanelClient(slug).then((res) => {
        if (res.data) {
          setJudges(res.data.judges);
          setInvites(res.data.invites);
        }
      }),
    [slug],
  );

  useEffect(() => {
    let active = true;
    fetchJudgePanelClient(slug).then((res) => {
      if (!active || !res.data) return;
      setJudges(res.data.judges);
      setInvites(res.data.invites);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  async function saveScope(judge: OrganizerJudgeProgress) {
    const res = await updateJudgeScopeClient(slug, judge.id, scopeDraft);
    if (res.error) {
      setNotice({ tone: "error", text: res.error });
      return;
    }
    setNotice({
      tone: "success",
      text: `${judge.name}'s tracks updated${res.data?.withdrawn ? `; ${res.data.withdrawn} unscored assignments withdrawn` : ""}.`,
    });
    setEditing(null);
    await load();
    onChange();
  }

  async function remove(judge: OrganizerJudgeProgress) {
    if (!window.confirm(`Remove ${judge.name} from the panel? Their unscored assignments are withdrawn.`)) return;
    const res = await removeJudgeClient(slug, judge.id);
    setNotice(res.error ? { tone: "error", text: res.error } : { tone: "success", text: `${judge.name} removed.` });
    await load();
    onChange();
  }

  if (!judges) return <Spinner />;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
        <Panel title={`Judge panel · ${judges.length}`} description="Track judges only ever see projects in their tracks.">
          {judges.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No judges yet. Send an invite link to get started.</p>
          ) : (
            <ul className="divide-y divide-line">
              {judges.map((judge) => (
                <li key={judge.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{judge.name}</p>
                        {judge.status ? <StatusChip status={judge.status} /> : null}
                      </div>
                      <p className="text-xs text-zinc-500">{judge.email}</p>
                      <p className="mt-2 flex flex-wrap gap-1.5">
                        {(judge.tracks?.length ? judge.tracks : ["All tracks"]).map((name) => (
                          <span key={name} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                            {name}
                          </span>
                        ))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-zinc-500">
                        {judge.completed}/{judge.assigned} scored
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditing(editing === judge.id ? null : judge.id);
                          setScopeDraft(judge.trackIds ?? []);
                        }}
                      >
                        Tracks
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => void remove(judge)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                  {editing === judge.id ? (
                    <div className="mt-4 space-y-3 rounded-xl border border-line bg-zinc-50 p-4">
                      <TrackPicker tracks={tracks} value={scopeDraft} onChange={setScopeDraft} idPrefix={`scope-${judge.id}`} />
                      <p className="text-xs text-zinc-500">
                        Unscored assignments outside the new tracks are withdrawn. Scored ones block the change.
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void saveScope(judge)}>
                          Save tracks
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="space-y-6">
        <InviteForm
          slug={slug}
          tracks={tracks}
          onCreated={async () => {
            await load();
          }}
        />
        <SeatForm
          slug={slug}
          tracks={tracks}
          onSeated={async (text) => {
            setNotice({ tone: "success", text });
            await load();
            onChange();
          }}
        />
        {invites.length ? (
          <Panel title="Open invites">
            <ul className="space-y-3">
              {invites.map((invite) => (
                <li key={invite.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-semibold text-ink">{invite.email ?? "Anyone with the link"}</p>
                      <p className="text-xs text-zinc-500">
                        {invite.tracks.length ? invite.tracks.join(", ") : "All tracks"} ·{" "}
                        {invite.expired ? "expired" : `expires ${formatDateTime(invite.expiresAt)}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        await revokeJudgeInviteClient(slug, invite.id);
                        await load();
                      }}
                    >
                      Revoke
                    </Button>
                  </div>
                  <CopyLink url={invite.url} />
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function InviteForm({ slug, tracks, onCreated }: { slug: string; tracks: Track[]; onCreated: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [days, setDays] = useState(14);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createJudgeInviteClient(slug, { email: email.trim() || undefined, trackIds, expiresInDays: days });
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error ?? "Could not create the invite.");
      return;
    }
    setLink(res.data.url);
    setEmail("");
    await onCreated();
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white">
      <div aria-hidden className="graph-paper-dark absolute inset-0" />
      <form onSubmit={submit} className="relative space-y-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">Invite a judge</p>
          <p className="mt-2 text-sm text-white/65">
            A single-use link. Whoever accepts it joins the panel with the tracks you pick.
          </p>
        </div>
        <div>
          <label htmlFor="inv-email" className="mb-1.5 block text-[13px] font-semibold text-white/80">
            Email <span className="font-normal text-white/45">(optional, locks the link to one account)</span>
          </label>
          <input
            id="inv-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            placeholder="judge@example.org"
          />
        </div>
        <div className="rounded-xl bg-white p-3 text-ink">
          <TrackPicker tracks={tracks} value={trackIds} onChange={setTrackIds} idPrefix="inv-track" />
        </div>
        <div>
          <label htmlFor="inv-days" className="mb-1.5 block text-[13px] font-semibold text-white/80">
            Expires after (days)
          </label>
          <input
            id="inv-days"
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(e) => setDays(Math.min(90, Math.max(1, Number(e.target.value) || 1)))}
            className="field w-28"
          />
        </div>
        <Button type="submit" variant="signal" disabled={busy}>
          {busy ? "Creating…" : "Create invite link"}
        </Button>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {link ? (
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-xs text-white/70">Share this link with the judge:</p>
            <CopyLink url={link} dark />
          </div>
        ) : null}
      </form>
    </div>
  );
}

function SeatForm({
  slug,
  tracks,
  onSeated,
}: {
  slug: string;
  tracks: Track[];
  onSeated: (text: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [trackIds, setTrackIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await seatJudgeClient(slug, { email: email.trim(), trackIds });
    if (res.error) {
      setError(res.error);
      return;
    }
    setEmail("");
    setTrackIds([]);
    await onSeated(`${email.trim()} added to the panel.`);
  }

  return (
    <Panel title="Add an existing judge" description="For accounts that already have the judge role.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="seat-email" className="field-label">
            Judge email
          </label>
          <input
            id="seat-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </div>
        <TrackPicker tracks={tracks} value={trackIds} onChange={setTrackIds} idPrefix="seat-track" />
        <Button type="submit" size="sm" variant="secondary">
          Add to panel
        </Button>
        {error ? <Alert tone="error">{error}</Alert> : null}
      </form>
    </Panel>
  );
}

function CopyLink({ url, dark = false }: { url: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <code
        className={`min-w-0 flex-1 truncate rounded-md px-2 py-1.5 font-mono text-xs ${
          dark ? "bg-black/30 text-white/85" : "bg-zinc-100 text-zinc-700"
        }`}
      >
        {url}
      </code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className={`shrink-0 rounded-md px-2 py-1.5 font-mono text-[11px] uppercase ${
          dark ? "bg-signal-300 text-ink" : "bg-ink text-white"
        }`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

