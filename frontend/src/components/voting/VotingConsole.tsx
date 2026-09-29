"use client";

import { useCallback, useEffect, useState } from "react";
import {
  exportUrl,
  fetchVotersClient,
  fetchVotingAdminClient,
  fetchVotingTallyClient,
  rotateVotingLinkClient,
  saveVotingConfigClient,
  voidVoterClient,
  type EventRef,
  type VoterRow,
  type VotingAccess,
  type VotingConfig,
  type VotingMode,
  type VotingTally,
} from "@/lib/api";
import { formatDateTime, fromLocalInput, relativeTime, toLocalInput } from "@/lib/format";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeaderBand } from "@/components/ui/PageShell";
import { Label, Panel, Spinner } from "@/components/judging/shared";

const ACCESS: Array<{ id: VotingAccess; title: string; body: string }> = [
  { id: "authenticated", title: "Signed-in accounts", body: "One ballot per account. Strongest identity, most friction." },
  { id: "email", title: "Email-gated", body: "One ballot per verified email; aliases like name+x@ collapse into one." },
  { id: "open", title: "Open link", body: "Anyone with the secret link. Easiest to reach, weakest identity; watch the flags." },
];

const MODES: Array<{ id: VotingMode; title: string; body: string }> = [
  { id: "quadratic", title: "Quadratic", body: "A budget of credits; n credits on one project = √n votes." },
  { id: "simple", title: "One vote per project", body: "Pick up to N projects, one vote each." },
];

export function VotingConsole({ slug }: { slug: string }) {
  const [event, setEvent] = useState<EventRef | null>(null);
  const [config, setConfig] = useState<VotingConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    fetchVotingAdminClient(slug).then((res) => {
      if (!active) return;
      if (res.data) {
        setEvent(res.data.event);
        setConfig(res.data.config);
      } else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  if (error) return <p className="py-16 text-center text-red-600">{error}</p>;
  if (!event || !config) return <Spinner />;

  return (
    <main className="pb-24">
      <PageHeaderBand
        eyebrow={`Organizer / ${event.name}`}
        title="Community voting"
        mark="voting"
        description="Set who can vote and how, share the ballot, watch the live tally and review suspicious ballots."
        badge={
          <Badge tone={config.state === "open" ? "success" : config.state === "off" ? "default" : "brand"}>
            {config.state === "off" ? "Off" : config.state === "open" ? "Voting open" : config.state === "scheduled" ? "Scheduled" : "Closed"}
          </Badge>
        }
        action={
          <>
            <ButtonLink href={`/organizer/events/${slug}/audit`} variant="secondary" size="sm">
              Audit trail
            </ButtonLink>
            <ButtonLink href={`/organizer/events/${slug}`} variant="ghost" size="sm">
              Event overview
            </ButtonLink>
          </>
        }
      />
      <div className="mx-auto max-w-7xl space-y-6 px-5 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Settings
            slug={slug}
            config={config}
            onSaved={(next) => {
              setConfig(next);
              setVersion((v) => v + 1);
            }}
          />
          <ShareBox slug={slug} config={config} onRotated={setConfig} />
        </div>
        <Tally key={`t${version}`} slug={slug} />
        <Voters key={`v${version}`} slug={slug} onChange={() => setVersion((v) => v + 1)} />
      </div>
    </main>
  );
}

function Settings({ slug, config, onSaved }: { slug: string; config: VotingConfig; onSaved: (c: VotingConfig) => void }) {
  const [form, setForm] = useState({
    enabled: config.enabled,
    access: config.access,
    mode: config.mode,
    credits: config.credits,
    opensAt: toLocalInput(config.opensAt),
    closesAt: toLocalInput(config.closesAt),
    resultsPublished: config.resultsPublished,
  });
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setNotice(null);
    const res = await saveVotingConfigClient(slug, {
      ...form,
      opensAt: fromLocalInput(form.opensAt),
      closesAt: fromLocalInput(form.closesAt),
    });
    setSaving(false);
    if (res.error || !res.data) {
      setNotice({ tone: "error", text: res.error ?? "Could not save." });
      return;
    }
    setNotice({ tone: "success", text: "Voting settings saved." });
    onSaved(res.data.config);
  }

  return (
    <Panel
      title="Settings"
      description="Mode and budget lock once the first vote is cast, so every ballot plays by the same rules."
      action={
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            className="h-4 w-4 accent-ink"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          Voting enabled
        </label>
      }
    >
      <div className="space-y-6">
        <Choice label="Who can vote" options={ACCESS} value={form.access} onChange={(access) => setForm({ ...form, access })} />
        <Choice label="Ballot type" options={MODES} value={form.mode} onChange={(mode) => setForm({ ...form, mode })} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="v-credits" className="field-label">
              {form.mode === "quadratic" ? "Credits per voter" : "Votes per voter"}
            </label>
            <input
              id="v-credits"
              type="number"
              min={1}
              max={100}
              value={form.credits}
              onChange={(e) => setForm({ ...form, credits: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="v-open" className="field-label">
              Opens
            </label>
            <input id="v-open" type="datetime-local" value={form.opensAt} onChange={(e) => setForm({ ...form, opensAt: e.target.value })} className="field" />
          </div>
          <div>
            <label htmlFor="v-close" className="field-label">
              Closes
            </label>
            <input id="v-close" type="datetime-local" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} className="field" />
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-line bg-zinc-50 p-4">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-ink"
            checked={form.resultsPublished}
            onChange={(e) => setForm({ ...form, resultsPublished: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Publish results</span>
            <span className="block text-sm text-zinc-500">
              Only possible after voting closes. Until then nobody but organizers can see any tally.
            </span>
          </span>
        </label>
        <div className="flex items-center gap-3">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
          {notice ? <span className={`text-sm ${notice.tone === "error" ? "text-red-600" : "text-emerald-700"}`}>{notice.text}</span> : null}
        </div>
      </div>
    </Panel>
  );
}

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: T; title: string; body: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="field-label">{label}</legend>
      <div className={`grid gap-2 ${options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {options.map((option) => (
          <label
            key={option.id}
            className={`cursor-pointer rounded-xl border p-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-600 ${
              value === option.id ? "border-ink bg-signal-50 ring-1 ring-ink" : "border-line hover:border-zinc-400"
            }`}
          >
            <input type="radio" className="sr-only" checked={value === option.id} onChange={() => onChange(option.id)} />
            <span className="block text-sm font-semibold text-ink">{option.title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{option.body}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ShareBox({ slug, config, onRotated }: { slug: string; config: VotingConfig; onRotated: (c: VotingConfig) => void }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/vote/${slug}${config.access === "open" && config.linkToken ? `?k=${config.linkToken}` : ""}`;

  return (
    <div className="relative h-fit overflow-hidden rounded-2xl bg-ink p-6 text-white">
      <div aria-hidden className="graph-paper-dark absolute inset-0" />
      <div className="relative space-y-4">
        <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">Ballot link</p>
        <code className="block rounded-lg bg-black/30 p-3 font-mono text-xs break-all text-white/85">{url}</code>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="signal"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
          {config.access === "open" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!window.confirm("Replace the link? The old one stops working immediately.")) return;
                const res = await rotateVotingLinkClient(slug);
                if (res.data) onRotated(res.data.config);
              }}
            >
              Replace link
            </Button>
          ) : null}
        </div>
        <p className="text-xs leading-relaxed text-white/55">
          {config.access === "open"
            ? "The key in this link is the only credential. If it leaks somewhere you didn't intend, replace it."
            : config.access === "email"
              ? "Voters confirm an email address with a one-time code before they get a ballot."
              : "Voters sign in first; each account gets one ballot."}
        </p>
        {config.closesAt ? (
          <p className="border-t border-dashed border-white/15 pt-3 text-xs text-white/55">
            Closes {formatDateTime(config.closesAt)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Tally({ slug }: { slug: string }) {
  const [data, setData] = useState<VotingTally | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchVotingTallyClient(slug).then((res) => {
        if (active && res.data) setData(res.data);
      });
    load();
    const timer = setInterval(load, 20_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [slug]);

  if (!data) return <Spinner />;
  const quadratic = data.config.mode === "quadratic";
  const top = Math.max(0.01, ...data.projects.map((p) => p.score));

  return (
    <Panel
      title="Live tally · organizers only"
      description={
        quadratic
          ? "Score = Σ √credits. Headcount rank shows what one-person-one-vote would have said."
          : "One vote per supporter."
      }
      action={
        <div className="flex gap-2">
          <a href={exportUrl(slug, "votes")} className="font-mono text-[11px] text-zinc-600 uppercase hover:text-ink" download>
            Tally CSV ↓
          </a>
        </div>
      }
    >
      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Ballots", data.ballots.total],
          ["Counted", data.ballots.counted],
          ["Flagged", data.ballots.flagged],
          ["Voided", data.ballots.voided],
          ["On the ballot", data.ballotSize],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-line bg-zinc-50 px-4 py-3">
            <dt className="font-mono text-[10px] tracking-[0.12em] text-zinc-500 uppercase">{label}</dt>
            <dd className="font-display mt-1 text-2xl font-semibold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="-mx-5 overflow-x-auto sm:-mx-6">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left font-mono text-[11px] tracking-[0.12em] text-zinc-500 uppercase">
            <tr>
              <th className="px-5 py-2.5 font-medium sm:pl-6">Rank</th>
              <th className="px-3 py-2.5 font-medium">Project</th>
              <th className="px-3 py-2.5 text-right font-medium">Supporters</th>
              {quadratic ? <th className="px-3 py-2.5 text-right font-medium">Credits</th> : null}
              {quadratic ? <th className="px-3 py-2.5 text-right font-medium">Headcount rank</th> : null}
              <th className="px-3 py-2.5 text-right font-medium" title="Average position on voters' shuffled ballots">
                Avg. slot
              </th>
              <th className="px-5 py-2.5 text-right font-medium sm:pr-6">Score</th>
            </tr>
          </thead>
          <tbody>
            {data.projects.map((row) => (
              <tr key={row.projectId} className="border-t border-line">
                <td className="px-5 py-3 font-display font-semibold text-ink sm:pl-6">{row.rank ?? "—"}</td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-ink">{row.title}</p>
                  <div className="mt-1 h-1 w-40 max-w-full rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-signal-400" style={{ width: `${(row.score / top) * 100}%` }} />
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-mono text-zinc-600">{row.supporters}</td>
                {quadratic ? <td className="px-3 py-3 text-right font-mono text-zinc-600">{row.credits}</td> : null}
                {quadratic ? <td className="px-3 py-3 text-right font-mono text-zinc-600">{row.headcountRank ?? "—"}</td> : null}
                <td className="px-3 py-3 text-right font-mono text-zinc-600">{row.avgPosition ?? "—"}</td>
                <td className="px-5 py-3 text-right font-display text-base font-semibold text-ink tabular-nums sm:pr-6">
                  {row.score.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Voters({ slug, onChange }: { slug: string; onChange: () => void }) {
  const [rows, setRows] = useState<VoterRow[] | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchVotersClient(slug).then((res) => {
        if (res.data) setRows(res.data.voters);
      }),
    [slug],
  );

  useEffect(() => {
    let active = true;
    fetchVotersClient(slug).then((res) => {
      if (active && res.data) setRows(res.data.voters);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  async function toggle(row: VoterRow) {
    setError(null);
    let reason: string | undefined;
    if (!row.voided) {
      const answer = window.prompt(`Why void the ballot from ${row.label}? This is recorded in the audit trail.`);
      if (!answer?.trim()) return;
      reason = answer.trim();
    }
    const res = await voidVoterClient(slug, row.id, !row.voided, reason);
    if (res.error) {
      setError(res.error);
      return;
    }
    await load();
    onChange();
  }

  if (!rows) return <Spinner />;
  const visible = onlyFlagged ? rows.filter((r) => r.flags.length || r.voided) : rows;

  return (
    <Panel
      title="Ballot review"
      description="Signals, not verdicts: a shared campus network can look like one device. Void only with a reason."
      action={
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" className="h-4 w-4 accent-ink" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
            Flagged only
          </label>
          <a href={exportUrl(slug, "ballots")} className="font-mono text-[11px] text-zinc-600 uppercase hover:text-ink" download>
            Ballots CSV ↓
          </a>
        </div>
      }
    >
      {error ? (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          {onlyFlagged ? "Nothing suspicious so far." : "No ballots yet."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((row) => (
            <li key={row.id} className={`flex flex-wrap items-start justify-between gap-3 py-3 ${row.voided ? "opacity-60" : ""}`}>
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {row.label} <span className="font-mono text-[11px] font-normal text-zinc-400">{row.kind} · device {row.fingerprint}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  {row.projects} projects · {row.creditsSpent} spent · {row.createdAt ? relativeTime(row.createdAt) : ""}
                </p>
                {row.flags.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {row.flags.map((flag) => (
                      <Badge key={flag} tone="warning">
                        {flag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {row.voided ? <p className="mt-1 text-xs text-red-700">Voided: {row.voidReason}</p> : null}
              </div>
              <Button size="sm" variant={row.voided ? "secondary" : "ghost"} className={row.voided ? "" : "text-red-600 hover:bg-red-50"} onClick={() => void toggle(row)}>
                {row.voided ? "Restore" : "Void"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Label className="mt-4">Voided ballots stay on record and can be restored.</Label>
    </Panel>
  );
}
