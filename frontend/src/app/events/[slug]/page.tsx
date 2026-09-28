import Link from "next/link";
import { notFound } from "next/navigation";
import { EventRegisterButton } from "@/components/EventRegisterButton";
import { OrganizerOnly } from "@/components/RoleGuards";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatDateTime, phaseInfo, relativeTime } from "@/lib/format";
import { fetchEventBySlug } from "@/lib/server-api";

type EventSlugPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EventSlugPage({ params }: EventSlugPageProps) {
  const { slug } = await params;
  const event = await fetchEventBySlug(slug);

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
    { label: "Submission deadline", at: event.submissionsClose },
    { label: "Judging starts", at: event.judgingStarts },
    { label: "Judging ends", at: event.judgingEnds },
    { label: "Results announced", at: event.resultsAt },
  ]
    .filter((item): item is { label: string; at: string } => Boolean(item.at))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const deadlinePassed = new Date(event.submissionsClose).getTime() < now;

  return (
    <main className="min-h-screen bg-[#0b1020] text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(124,58,237,0.45),_transparent_50%),radial-gradient(ellipse_at_bottom_left,_rgba(14,165,233,0.25),_transparent_45%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-12 lg:pb-20 lg:pt-16">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-200 backdrop-blur">
              Hackathon
            </span>
            <Badge tone={phase.tone}>{phase.label}</Badge>
            {!event.published ? <Badge tone="warning">Hidden from public</Badge> : null}
          </div>

          <h1 className="font-display mt-5 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            {event.name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-300">
            {event.shortDescription ||
              "Build something ambitious. Form a team. Ship before the deadline."}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#register"
              className="inline-flex items-center rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:scale-[1.02]"
            >
              {event.state.registrationOpen ? "Register to participate →" : "Your participation →"}
            </a>
            <ButtonLink href={`/projects?event=${event.slug}`} variant="outline" size="md">
              Browse projects
            </ButtonLink>
            <OrganizerOnly>
              <ButtonLink href={`/organizer/events/${event.slug}`} variant="outline" size="md">
                Manage event
              </ButtonLink>
            </OrganizerOnly>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStat
              label={deadlinePassed ? "Submissions closed" : "Submissions close"}
              value={formatDateTime(event.submissionsClose)}
              hint={relativeTime(event.submissionsClose, now)}
              small
            />
            <HeroStat label="Tracks" value={String(event.tracks.length)} />
            <HeroStat label="Prizes" value={String(event.prizes.length)} />
            <HeroStat label="Team size" value={`1–${event.maxTeamSize}`} />
          </div>
        </div>
      </section>

      <section className="rounded-t-[2.5rem] bg-[#f4f6fb] pb-20 pt-12 text-zinc-900">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-12">
            {event.description ? (
              <div>
                <h2 className="font-display text-2xl font-bold">About</h2>
                <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-zinc-700">
                  {event.description}
                </p>
              </div>
            ) : null}

            <div>
              <h2 className="font-display text-2xl font-bold">Timeline</h2>
              <p className="mt-1 text-sm text-zinc-500">Shown in your local time.</p>
              <ol className="relative mt-8 border-l-2 border-violet-200 pl-8">
                {timeline.map((item, index) => {
                  const past = new Date(item.at).getTime() <= now;
                  return (
                    <li key={item.label} className="relative pb-8 last:pb-0">
                      <span
                        className={`absolute -left-[41px] flex h-6 w-6 items-center justify-center rounded-full border-4 border-white text-[10px] font-bold text-white shadow ${
                          past ? "bg-zinc-400" : "bg-violet-600"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                        {item.label}
                      </p>
                      <p className={`mt-1 text-base font-semibold ${past ? "text-zinc-500" : "text-zinc-900"}`}>
                        {formatDateTime(item.at)}{" "}
                        <span className="text-sm font-normal text-zinc-400">· {relativeTime(item.at, now)}</span>
                      </p>
                    </li>
                  );
                })}
              </ol>
            </div>

            {event.prizes.length > 0 ? (
              <div>
                <h2 className="font-display text-2xl font-bold">Prizes</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {event.prizes.map((prize, i) => (
                    <div
                      key={prize.id}
                      className={`relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm ${
                        i === 0 ? "bg-gradient-to-br from-amber-50 to-white sm:col-span-2" : ""
                      }`}
                    >
                      <p className="text-sm font-semibold text-zinc-500">{prize.name}</p>
                      <p className="font-display mt-2 text-3xl font-extrabold text-violet-700">
                        {prize.amount}
                      </p>
                      <p className="mt-2 text-xs text-zinc-400">
                        {prize.trackName ? `Track · ${prize.trackName}` : "Overall"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <h2 className="font-display text-2xl font-bold">Tracks</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {event.tracks.map((track) => (
                  <Link
                    key={track.id}
                    href={`/projects?event=${event.slug}&track=${track.id}`}
                    className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white">
                      {track.name.slice(0, 1)}
                    </div>
                    <p className="mt-3 font-semibold text-zinc-900">{track.name}</p>
                    <p className="mt-1 text-sm text-zinc-500">{track.description || "Open track"}</p>
                  </Link>
                ))}
              </div>
            </div>

            {event.rubric.length > 0 ? (
              <div>
                <h2 className="font-display text-2xl font-bold">Judging rubric</h2>
                <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-left text-zinc-500">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Criterion</th>
                        <th className="px-6 py-3 font-semibold">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {event.rubric.map((c) => (
                        <tr key={c.name} className="border-t border-zinc-100">
                          <td className="px-6 py-4 font-medium capitalize text-zinc-900">{c.name}</td>
                          <td className="px-6 py-4">
                            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                              ×{c.weight}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div
              id="register"
              className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-300/40"
            >
              <div className="bg-gradient-to-br from-violet-600 to-indigo-700 px-6 py-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
                  Join this hackathon
                </p>
                <p className="mt-2 text-lg font-bold">
                  {event.state.registrationOpen ? "Registration is open" : "Your participation"}
                </p>
              </div>
              <div className="p-6">
                <EventRegisterButton event={event} />
                <div className="mt-6 space-y-2 border-t border-zinc-100 pt-5 text-xs text-zinc-500">
                  <p>
                    Teams of up to {event.maxTeamSize}. Drafts can be edited until{" "}
                    <strong className="text-zinc-800">{formatDateTime(event.submissionsClose)}</strong>
                    ; after that nothing can change.
                  </p>
                  <p>
                    <Link href="/participant" className="font-semibold text-violet-600">
                      Open your participant hub →
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function HeroStat({
  label,
  value,
  hint,
  small = false,
}: {
  label: string;
  value: string;
  hint?: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className={`font-display mt-1 font-bold text-white ${small ? "text-lg" : "text-3xl"}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}
