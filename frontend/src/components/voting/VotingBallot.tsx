"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchBallotClient,
  fetchPublicVoteResultsClient,
  saveBallotClient,
  startEmailVoteClient,
  verifyEmailVoteClient,
  type Ballot,
  type VoteRow,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { loginHref } from "@/lib/role-auth";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeaderBand } from "@/components/ui/PageShell";

export function VotingBallot({ slug, link }: { slug: string; link: string | null }) {
  const [ballot, setBallot] = useState<Ballot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchBallotClient(slug, link).then((res) => {
      if (!active) return;
      if (!res.data) {
        setError(res.error);
        return;
      }
      setBallot(res.data);
      setDraft(res.data.allocations);
      setSaved(res.data.allocations);
    });
    return () => {
      active = false;
    };
  }, [slug, link, reloadKey]);

  const spent = useMemo(() => Object.values(draft).reduce((a, b) => a + b, 0), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <EmptyState title="No vote here" description={error} action={<ButtonLink href="/events">Browse events</ButtonLink>} />
      </main>
    );
  }
  if (!ballot) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-ink" />
      </div>
    );
  }

  const { config } = ballot;
  const quadratic = config.mode === "quadratic";
  const remaining = config.credits - spent;
  const open = config.state === "open";

  function change(projectId: string, value: number) {
    setNotice(null);
    setDraft((prev) => {
      const next = { ...prev };
      if (value <= 0) delete next[projectId];
      else next[projectId] = value;
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    const res = await saveBallotClient(slug, draft, link);
    setSaving(false);
    if (res.error) {
      setNotice({ tone: "error", text: res.error });
      return;
    }
    setSaved(draft);
    setNotice({ tone: "success", text: "Ballot saved. You can change it until voting closes." });
  }

  return (
    <main className="pb-24">
      <PageHeaderBand
        eyebrow={`Community vote / ${ballot.event.name}`}
        title="Cast your votes"
        mark="votes"
        description={
          quadratic
            ? `You have ${config.credits} credits. Putting n credits on a project gives it √n votes, so spreading support goes further than piling it on one project.`
            : `Pick up to ${config.credits} project${config.credits === 1 ? "" : "s"} you'd like to see win. One vote each.`
        }
        badge={
          <>
            <Badge tone={open ? "success" : "default"}>
              {config.state === "open" ? "Voting open" : config.state === "scheduled" ? "Opens soon" : "Voting closed"}
            </Badge>
            <Badge tone="ink">{quadratic ? "Quadratic" : "One vote per project"}</Badge>
            {open && config.closesAt ? <Countdown to={config.closesAt} closedLabel="Closed" /> : null}
          </>
        }
      />
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        {ballot.needs ? (
          <Gate slug={slug} needs={ballot.needs} onVerified={() => setReloadKey((k) => k + 1)} />
        ) : config.state === "scheduled" ? (
          <EmptyState title="Voting hasn't opened yet" description={`Come back ${formatDateTime(config.opensAt)}.`} />
        ) : config.state === "closed" ? (
          ballot.resultsAvailable ? (
            <PublicResults slug={slug} />
          ) : (
            <EmptyState
              title="Voting has closed"
              description="Results stay private until the organizers publish them."
              action={<ButtonLink href={`/events/${slug}`}>Back to the event</ButtonLink>}
            />
          )
        ) : ballot.voter?.voided ? (
          <Alert tone="warning" title="This ballot was voided">
            The organizers voided this ballot after an abuse review, so it doesn&apos;t count.
          </Alert>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <ol className="space-y-3">
              {ballot.projects.map((project) => (
                <BallotCard
                  key={project.id}
                  project={project}
                  value={draft[project.id] ?? 0}
                  quadratic={quadratic}
                  remaining={remaining}
                  onChange={(value) => change(project.id, value)}
                />
              ))}
            </ol>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white">
                <div aria-hidden className="graph-paper-dark absolute inset-0" />
                <div className="relative">
                  <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">
                    {quadratic ? "Credits left" : "Votes left"}
                  </p>
                  <p className="font-display mt-2 text-5xl font-semibold tabular-nums">
                    {remaining}
                    <span className="text-2xl text-white/40"> / {config.credits}</span>
                  </p>
                  <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-signal-300 transition-all" style={{ width: `${(spent / config.credits) * 100}%` }} />
                  </div>
                  <p className="mt-4 text-sm text-white/60">
                    Voting as <span className="font-semibold text-white">{ballot.voter?.label}</span>
                  </p>
                  <Button variant="signal" className="mt-5 w-full" disabled={!dirty || saving || remaining < 0} onClick={() => void save()}>
                    {saving ? "Saving…" : dirty ? "Save ballot" : "Ballot saved"}
                  </Button>
                  {remaining < 0 ? <p className="mt-2 text-sm text-red-300">You&apos;re over budget.</p> : null}
                </div>
              </div>
              {notice ? (
                <div className="mt-4">
                  <Alert tone={notice.tone}>{notice.text}</Alert>
                </div>
              ) : null}
              <div className="mt-4 space-y-2 rounded-xl border border-line bg-white p-4 text-sm leading-relaxed text-zinc-600">
                <p>
                  <span className="font-semibold text-ink">Shuffled for you.</span> Every voter sees the projects in a different
                  order, so nobody wins just by being listed first.
                </p>
                <p>
                  <span className="font-semibold text-ink">Results stay hidden</span> from everyone except the organizers until
                  voting closes.
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function BallotCard({
  project,
  value,
  quadratic,
  remaining,
  onChange,
}: {
  project: Ballot["projects"][number];
  value: number;
  quadratic: boolean;
  remaining: number;
  onChange: (value: number) => void;
}) {
  const influence = quadratic ? Math.sqrt(value) : value;
  return (
    <li
      className={`flex flex-col gap-4 rounded-2xl border bg-white p-4 transition sm:flex-row sm:items-center ${
        value > 0 ? "border-ink shadow-[0_8px_24px_-16px_rgba(21,19,43,0.35)]" : "border-line"
      }`}
    >
      <div className="aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg bg-zinc-100 sm:w-36">
        {project.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="graph-paper flex h-full items-center justify-center font-display text-2xl font-semibold text-zinc-300">
            {project.title.charAt(0)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] tracking-[0.12em] text-zinc-400 uppercase">
          {project.track} · {project.teamName}
        </p>
        <Link href={`/projects/${project.id}`} target="_blank" className="font-display mt-1 block font-semibold text-ink hover:underline">
          {project.title}
        </Link>
        {project.tagline ? <p className="mt-0.5 line-clamp-2 text-sm text-zinc-500">{project.tagline}</p> : null}
      </div>
      <div className="shrink-0">
        {project.own ? (
          <Badge>Your team</Badge>
        ) : quadratic ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center overflow-hidden rounded-lg border border-line">
              <button
                type="button"
                aria-label={`Remove a credit from ${project.title}`}
                disabled={value <= 0}
                onClick={() => onChange(value - 1)}
                className="flex h-10 w-10 items-center justify-center text-lg font-semibold text-ink hover:bg-zinc-100 disabled:opacity-30"
              >
                −
              </button>
              <span className="w-10 text-center font-display text-lg font-semibold tabular-nums" aria-live="polite">
                {value}
              </span>
              <button
                type="button"
                aria-label={`Add a credit to ${project.title}`}
                disabled={remaining <= 0}
                onClick={() => onChange(value + 1)}
                className="flex h-10 w-10 items-center justify-center text-lg font-semibold text-ink hover:bg-zinc-100 disabled:opacity-30"
              >
                +
              </button>
            </div>
            <div className="w-16 text-right">
              <p className="font-display text-lg font-semibold text-ink tabular-nums">{influence.toFixed(1)}</p>
              <p className="font-mono text-[10px] tracking-wide text-zinc-400 uppercase">votes</p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            aria-pressed={value > 0}
            disabled={value === 0 && remaining <= 0}
            onClick={() => onChange(value > 0 ? 0 : 1)}
            className={`h-10 rounded-lg px-4 text-sm font-semibold transition disabled:opacity-40 ${
              value > 0 ? "bg-signal-300 text-ink" : "border border-line bg-white text-ink hover:border-ink"
            }`}
          >
            {value > 0 ? "✓ Voted" : "Vote"}
          </button>
        )}
      </div>
    </li>
  );
}

function Gate({ slug, needs, onVerified }: { slug: string; needs: "signin" | "email" | "link"; onVerified: () => void }) {
  if (needs === "signin") {
    return (
      <EmptyState
        title="Sign in to vote"
        description="This vote is open to signed-in accounts. One ballot per account."
        action={<ButtonLink href={loginHref(`/vote/${slug}`)}>Sign in</ButtonLink>}
      />
    );
  }
  if (needs === "link") {
    return (
      <EmptyState
        title="You need the voting link"
        description="This vote is open to anyone holding the link the organizers shared. Open that link to vote."
      />
    );
  }
  return <EmailGate slug={slug} onVerified={onVerified} />;
}

function EmailGate({ slug, onVerified }: { slug: string; onVerified: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await startEmailVoteClient(slug, email);
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error ?? "Could not send a code.");
      return;
    }
    setSent(true);
    setDevCode(res.data.devCode ?? null);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await verifyEmailVoteClient(slug, email, code);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onVerified();
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-ink">Verify your email to vote</h2>
      <p className="mt-2 text-sm text-zinc-500">One ballot per email address. We send a 6-digit code; no account needed.</p>
      {!sent ? (
        <form onSubmit={send} className="mt-6 space-y-4">
          <div>
            <label htmlFor="vote-email" className="field-label">
              Email
            </label>
            <input id="vote-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 space-y-4">
          {devCode ? (
            <Alert tone="info" title="Development mode">
              No email service is configured, so here is the code: <strong className="font-mono">{devCode}</strong>
            </Alert>
          ) : (
            <p className="text-sm text-zinc-600">Check {email} for your code. It expires in 15 minutes.</p>
          )}
          <div>
            <label htmlFor="vote-code" className="field-label">
              6-digit code
            </label>
            <input
              id="vote-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="field font-mono tracking-[0.4em]"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || code.length !== 6}>
              {busy ? "Checking…" : "Verify and vote"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSent(false)}>
              Use another email
            </Button>
          </div>
        </form>
      )}
      {error ? (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
    </div>
  );
}

export function PublicResults({ slug }: { slug: string }) {
  const [rows, setRows] = useState<VoteRow[] | null>(null);
  const [ballots, setBallots] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchPublicVoteResultsClient(slug).then((res) => {
      if (!active) return;
      if (res.data) {
        setRows(res.data.projects);
        setBallots(res.data.ballots);
      } else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  if (error) return <Alert tone="info">{error}</Alert>;
  if (!rows) return null;
  const top = rows[0]?.score || 1;
  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <h2 className="font-display text-xl font-semibold text-ink">
        People&apos;s choice <span className="font-mono text-sm font-normal text-zinc-500">· {ballots} ballots</span>
      </h2>
      <ol className="mt-5 space-y-3">
        {rows.map((row) => (
          <li key={row.projectId} className="grid grid-cols-[2.5rem_minmax(0,1fr)_4rem] items-center gap-3">
            <span className="font-display text-lg font-semibold text-ink">{row.rank}</span>
            <div className="min-w-0">
              <Link href={`/projects/${row.projectId}`} className="truncate font-semibold text-ink hover:underline">
                {row.title}
              </Link>
              <div className="mt-1 h-1.5 rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-signal-400" style={{ width: `${(row.score / top) * 100}%` }} />
              </div>
            </div>
            <span className="text-right font-mono text-sm text-zinc-600">{row.score.toFixed(1)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
