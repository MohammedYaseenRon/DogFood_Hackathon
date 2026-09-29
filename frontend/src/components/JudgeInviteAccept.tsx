"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  acceptJudgeInviteClient,
  fetchJudgeInviteClient,
  fetchMeClient,
  type JudgeInvitePreview,
  type UserInfo,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { loginHref, registerHref } from "@/lib/role-auth";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageShell } from "@/components/ui/PageShell";

type Loaded = { preview: JudgeInvitePreview | null; error: string | null; user: UserInfo | null };

async function load(token: string): Promise<Loaded> {
  const [invite, user] = await Promise.all([fetchJudgeInviteClient(token), fetchMeClient()]);
  return { preview: invite.data, error: invite.error, user };
}

export function JudgeInviteAccept({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    load(token).then((loaded) => {
      if (active) setState(loaded);
    });
    return () => {
      active = false;
    };
  }, [token]);

  if (!state) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-ink" />
      </div>
    );
  }

  if (!state.preview) {
    return (
      <PageShell title="Invitation unavailable" maxWidth="max-w-xl">
        <EmptyState
          title="This link can't be used"
          description={state.error ?? "Ask the organizer for a new judge invite."}
          action={<ButtonLink href="/">Go home</ButtonLink>}
        />
      </PageShell>
    );
  }

  const { preview, user } = state;
  const here = `/judge-invite/${token}`;

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await acceptJudgeInviteClient(token);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push("/judging");
    router.refresh();
  }

  return (
    <PageShell
      eyebrow="Judge invitation"
      title={`Judge ${preview.event.name}`}
      mark={preview.event.name}
      description="You've been invited to join this event's judging panel."
      maxWidth="max-w-3xl"
    >
      <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white md:flex-row">
        <div className="flex-1 space-y-6 p-6 sm:p-8">
          <div>
            <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">You&apos;ll review</p>
            <p className="mt-3 flex flex-wrap gap-2">
              {(preview.allTracks ? ["Every track"] : preview.tracks).map((name) => (
                <span key={name} className="rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-white">
                  {name}
                </span>
              ))}
            </p>
          </div>
          <ul className="space-y-2 text-sm text-zinc-600">
            <li className="flex gap-3">
              <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-[2px] bg-signal-400" />
              You score only the projects the organizer assigns you, on a 1–5 rubric.
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-[2px] bg-signal-400" />
              Scoring is blind: other judges never see your scores, and you never see theirs.
            </li>
          </ul>

          <div className="border-t border-line pt-6">
            {preview.alreadyJudge ? (
              <div className="space-y-4">
                <Alert tone="success">You&apos;re already on this panel.</Alert>
                <ButtonLink href="/judging">Open judging dashboard</ButtonLink>
              </div>
            ) : !user ? (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600">
                  Sign in or create an account to accept. You&apos;ll come back here afterwards.
                </p>
                <div className="flex flex-wrap gap-3">
                  <ButtonLink href={registerHref(here)}>Create account</ButtonLink>
                  <ButtonLink href={loginHref(here)} variant="secondary">
                    Sign in
                  </ButtonLink>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-600">
                  Accepting as <strong className="text-ink">{user.name || user.email}</strong>.
                </p>
                <Button size="lg" onClick={() => void accept()} disabled={busy}>
                  {busy ? "Joining…" : "Join the judge panel"}
                </Button>
                {error ? <Alert tone="error">{error}</Alert> : null}
              </div>
            )}
          </div>
        </div>
        <aside className="ticket-tear flex shrink-0 flex-row gap-6 bg-zinc-50 p-6 md:w-56 md:flex-col md:justify-center">
          {preview.email ? (
            <div>
              <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">For</p>
              <p className="mt-1 text-sm font-semibold break-all text-ink">{preview.email}</p>
            </div>
          ) : null}
          <div>
            <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Expires</p>
            <p className="mt-1 text-sm font-semibold text-ink">{formatDateTime(preview.expiresAt)}</p>
          </div>
          <div>
            <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Uses</p>
            <p className="mt-1 text-sm font-semibold text-ink">Single use</p>
          </div>
        </aside>
      </article>
    </PageShell>
  );
}
