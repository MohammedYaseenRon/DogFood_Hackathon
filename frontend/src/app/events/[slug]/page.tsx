import Link from "next/link";
import { notFound } from "next/navigation";
import { EventRegisterButton } from "@/components/EventRegisterButton";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Eyebrow } from "@/components/ui/MarkedTitle";
import { formatDateTime, phaseInfo } from "@/lib/format";
import { fetchEventBySlug, fetchMe } from "@/lib/server-api";

type EventSlugPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EventSlugPage({ params }: EventSlugPageProps) {
  const { slug } = await params;
  const [event, me] = await Promise.all([fetchEventBySlug(slug), fetchMe()]);

  if (!event) {
    notFound();
  }

  const phase = phaseInfo(event.state.phase);
  // Server clock from the API response: keeps render pure and matches deadline enforcement.
  const now = new Date(event.state.serverTime ?? event.submissionsClose).getTime();

  const timeline = [
    { label: "Registration opens", at: event.registrationOpens },
    { label: "Registration closes", at: event.registrationCloses },
    { label: "Hacking starts", at: event.eventStarts },
    { label: "Hacking ends", at: event.eventEnds },
    { label: "Submission deadline", at: event.submissionsClose, key: true },
    { label: "Judging starts", at: event.judgingStarts },
    { label: "Judging ends", at: event.judgingEnds },
    { label: "Results announced", at: event.resultsAt },
  ]
    .filter((item): item is { label: string; at: string; key?: boolean } => Boolean(item.at))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const deadlinePassed = new Date(event.submissionsClose).getTime() < now;
  // Staff and judges can't take part, so they get their own tools instead of "Register".
  const isStaff = me?.role === "ORGANIZER" || me?.role === "ADMIN";
  const isJudge = me?.role === "JUDGE";

  return (
    <main className="pb-24">
      <section className="relative overflow-hidden bg-ink text-white">
        <div aria-hidden className="graph-paper-dark absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-5 pb-14 pt-14 sm:px-6 lg:pb-16 lg:pt-20">
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow dark>Event</Eyebrow>
            <Badge tone={phase.tone}>{phase.label}</Badge>
            {!event.published ? <Badge tone="warning">Hidden from public</Badge> : null}
          </div>

          <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="font-display max-w-4xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                {event.name}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">
                {event.shortDescription || "Form a team, ship a project, and get judged before the deadline."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {isStaff ? (
                  <>
                    <ButtonLink href={`/organizer/events/${event.slug}`} variant="signal" size="lg">
                      Manage event
                    </ButtonLink>
                    <ButtonLink href={`/organizer/events/${event.slug}/judging`} variant="outline" size="lg">
                      Judging console
                    </ButtonLink>
                    {event.voting ? (
                      <ButtonLink href={`/organizer/events/${event.slug}/voting`} variant="outline" size="lg">
                        Community voting
                      </ButtonLink>
                    ) : null}
                  </>
                ) : isJudge ? (
                  <ButtonLink href="/judging" variant="signal" size="lg">
                    Judge dashboard
                  </ButtonLink>
                ) : (
                  <a
                    href="#participate"
                    className="inline-flex h-12 items-center rounded-lg bg-signal-300 px-6 text-[15px] font-semibold text-ink transition hover:bg-signal-400"
                  >
                    {event.state.registrationOpen ? "Register to participate" : "Your participation"}
                  </a>
                )}
                {!isStaff && event.voting?.state === "open" ? (
                  <ButtonLink href={`/vote/${event.slug}`} variant="white" size="lg">
                    Vote for projects
                  </ButtonLink>
                ) : null}
                {event.voting?.resultsPublished ? (
                  <ButtonLink href={`/vote/${event.slug}`} variant="white" size="lg">
                    People&apos;s choice results
                  </ButtonLink>
                ) : null}
                <ButtonLink href={`/projects?event=${event.slug}`} variant="outline" size="lg">
                  Browse projects
                </ButtonLink>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/[0.05] p-6 lg:min-w-[300px]">
              <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">
                {deadlinePassed ? "Submissions closed" : "Submissions close in"}
              </p>
              <div className="mt-3">
                <Countdown to={event.submissionsClose} tone="dark" className="text-base" closedLabel="Deadline passed" />
              </div>
              <p className="mt-3 font-mono text-sm text-white/80">{formatDateTime(event.submissionsClose)}</p>
              <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5 font-mono">
                {[
                  { label: "tracks", value: event.tracks.length },
                  { label: "prizes", value: event.prizes.length },
                  { label: "max team", value: event.maxTeamSize },
                ].map((item) => (
                  <div key={item.label}>
                    <dd className="text-xl font-semibold text-white">{item.value}</dd>
                    <dt className="text-[10px] tracking-[0.12em] text-white/45 uppercase">{item.label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-12 grid max-w-7xl gap-10 px-5 sm:px-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-14">
          {event.description ? (
            <section>
              <SectionTitle>About</SectionTitle>
              <p className="mt-4 max-w-3xl whitespace-pre-wrap text-base leading-relaxed text-zinc-700">
                {event.description}
              </p>
            </section>
          ) : null}

          <section>
            <SectionTitle hint="Your local time">Schedule</SectionTitle>
            <ol className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
              {timeline.map((item) => {
                const past = new Date(item.at).getTime() <= now;
                return (
                  <li
                    key={item.label}
                    className={`grid grid-cols-[auto_1fr] items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[auto_1fr_auto] ${
                      item.key ? "bg-signal-50" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-2.5 w-2.5 rounded-full ${past ? "bg-zinc-300" : item.key ? "bg-signal-400 ring-4 ring-signal-100" : "bg-ink"}`}
                    />
                    <span className={`font-medium ${past ? "text-zinc-400 line-through decoration-zinc-300" : "text-ink"}`}>
                      {item.label}
                    </span>
                    <span className={`col-start-2 font-mono text-sm sm:col-start-auto ${past ? "text-zinc-400" : "text-zinc-700"}`}>
                      {formatDateTime(item.at)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          {event.prizes.length > 0 ? (
            <section>
              <SectionTitle>Prizes</SectionTitle>
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {event.prizes.map((prize, i) => (
                  <li
                    key={prize.id}
                    className={`rounded-2xl border p-6 ${i === 0 ? "border-ink bg-ink text-white sm:col-span-2" : "border-line bg-white"}`}
                  >
                    <p className={`font-mono text-[11px] tracking-[0.14em] uppercase ${i === 0 ? "text-white/55" : "text-zinc-500"}`}>
                      {prize.trackName ? `Track · ${prize.trackName}` : "Overall"}
                    </p>
                    <p className={`font-display mt-3 font-semibold ${i === 0 ? "text-4xl text-signal-300" : "text-3xl text-ink"}`}>
                      {prize.amount}
                    </p>
                    <p className={`mt-1 text-sm ${i === 0 ? "text-white/80" : "text-zinc-600"}`}>{prize.name}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <SectionTitle>Tracks</SectionTitle>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {event.tracks.map((track) => (
                <li key={track.id}>
                  <Link
                    href={`/projects?event=${event.slug}&track=${track.id}`}
                    className="group block h-full rounded-xl border border-line bg-white p-5 transition hover:border-ink"
                  >
                    <p className="font-semibold text-ink">{track.name}</p>
                    <p className="mt-1 text-sm text-zinc-500">{track.description || "Open track"}</p>
                    <p className="mt-4 font-mono text-xs text-brand-700 opacity-0 transition group-hover:opacity-100">
                      see projects →
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {event.rubric.length > 0 ? (
            <section>
              <SectionTitle hint="How judges weigh each score">Judging rubric</SectionTitle>
              <ul className="mt-6 space-y-3">
                {(() => {
                  const total = event.rubric.reduce((sum, c) => sum + c.weight, 0) || 1;
                  return event.rubric.map((c) => {
                    const share = Math.round((c.weight / total) * 100);
                    return (
                      <li key={c.name} className="rounded-xl border border-line bg-white px-5 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium capitalize text-ink">{c.name}</span>
                          <span className="font-mono text-sm text-zinc-600">
                            ×{c.weight} · {share}%
                          </span>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                          <div className="h-full rounded-full bg-ink" style={{ width: `${share}%` }} />
                        </div>
                      </li>
                    );
                  });
                })()}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div id="participate" className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-white">
            <div className="border-b border-line bg-signal-50 px-6 py-5">
              <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Participate</p>
              <p className="font-display mt-2 text-lg font-semibold text-ink">
                {event.state.registrationOpen ? "Registration is open" : "Your participation"}
              </p>
            </div>
            <div className="p-6">
              <EventRegisterButton event={event} />
              <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-zinc-500">
                Teams of up to {event.maxTeamSize}. Drafts can be edited until{" "}
                <span className="font-mono text-zinc-700">{formatDateTime(event.submissionsClose)}</span>; after that
                nothing can change.{" "}
                <Link href="/participant" className="font-semibold text-brand-700 hover:underline">
                  Your hub →
                </Link>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
      <h2 className="font-display text-xl font-semibold text-ink">{children}</h2>
      {hint ? <p className="font-mono text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}
