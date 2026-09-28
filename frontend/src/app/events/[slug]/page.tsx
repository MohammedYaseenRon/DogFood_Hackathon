import Link from "next/link";
import { notFound } from "next/navigation";
import { EventRegisterButton } from "@/components/EventRegisterButton";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { fetchEventBySlug } from "@/lib/api";

type EventSlugPageProps = {
  params: Promise<{ slug: string }>;
};

function phaseLabel(phase: string) {
  return phase.replace(/_/g, " ");
}

export default async function EventSlugPage({ params }: EventSlugPageProps) {
  const { slug } = await params;
  const event = await fetchEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const phase = event.state?.phase ?? "UPCOMING";
  const open = Boolean(event.state?.registrationOpen);
  const submissionsOpen = Boolean(event.state?.submissionsOpen);

  const timeline = [
    {
      label: "Registration opens",
      at: event.registrationOpens,
      tone: "emerald",
    },
    {
      label: "Registration closes",
      at: event.registrationCloses,
      tone: "amber",
    },
    {
      label: "Submissions close",
      at: event.submissionsClose,
      tone: "violet",
    },
  ].filter((item) => item.at);

  return (
    <main className="min-h-screen bg-[#0b1020] text-white">
      {/* Devpost-style dark hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(124,58,237,0.45),_transparent_50%),radial-gradient(ellipse_at_bottom_left,_rgba(14,165,233,0.25),_transparent_45%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-12 lg:pb-20 lg:pt-16">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-200 backdrop-blur">
              Hackathon
            </span>
            <Badge tone={open ? "success" : submissionsOpen ? "brand" : "warning"}>
              {phaseLabel(phase)}
            </Badge>
          </div>

          <h1 className="font-display mt-5 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            {event.name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-300">
            {event.description ||
              event.shortDescription ||
              "Build something ambitious. Form a team. Ship before the deadline."}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#register"
              className="inline-flex items-center rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:scale-[1.02]"
            >
              {open ? "Register to participate →" : "View registration"}
            </a>
            <ButtonLink href="/projects" variant="outline" size="md">
              Browse gallery
            </ButtonLink>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <HeroStat label="Tracks" value={String(event.tracks.length)} />
            <HeroStat
              label="Prizes"
              value={String((event.prizes ?? []).length)}
            />
            <HeroStat
              label="Max team size"
              value={String(event.maxTeamSize ?? 4)}
            />
          </div>
        </div>
      </section>

      {/* Content on light surface */}
      <section className="rounded-t-[2.5rem] bg-[#f4f6fb] pb-20 pt-12 text-zinc-900">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-12">
            {/* Timeline */}
            <div>
              <h2 className="font-display text-2xl font-bold">Timeline</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Key dates for this hackathon
              </p>
              <ol className="relative mt-8 space-y-0 border-l-2 border-violet-200 pl-8">
                {timeline.map((item, index) => (
                  <li key={item.label} className="relative pb-10 last:pb-0">
                    <span
                      className={`absolute -left-[41px] flex h-6 w-6 items-center justify-center rounded-full border-4 border-white text-[10px] font-bold text-white shadow ${
                        item.tone === "emerald"
                          ? "bg-emerald-500"
                          : item.tone === "amber"
                            ? "bg-amber-500"
                            : "bg-violet-600"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      {item.label}
                    </p>
                    <p className="mt-1 text-base font-semibold text-zinc-900">
                      {item.at
                        ? new Date(item.at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Prizes */}
            {(event.prizes ?? []).length > 0 ? (
              <div>
                <h2 className="font-display text-2xl font-bold">Prizes</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {event.prizes.map((prize, i) => (
                    <div
                      key={prize.id}
                      className={`relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm ${
                        i === 0 ? "sm:col-span-2 bg-gradient-to-br from-amber-50 to-white" : ""
                      }`}
                    >
                      {i === 0 ? (
                        <span className="absolute right-4 top-4 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                          Top prize
                        </span>
                      ) : null}
                      <p className="text-sm font-semibold text-zinc-500">
                        {prize.name}
                      </p>
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

            {/* Tracks */}
            <div>
              <h2 className="font-display text-2xl font-bold">Tracks</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {event.tracks.map((track) => (
                  <div
                    key={track.id}
                    className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white">
                      {track.name.slice(0, 1)}
                    </div>
                    <p className="mt-3 font-semibold text-zinc-900">{track.name}</p>
                    {track.description ? (
                      <p className="mt-1 text-sm text-zinc-500">{track.description}</p>
                    ) : (
                      <p className="mt-1 text-xs text-zinc-400">Open track</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Rubric */}
            {(event.rubric ?? []).length > 0 ? (
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
                          <td className="px-6 py-4 font-medium capitalize text-zinc-900">
                            {c.name}
                          </td>
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

          {/* Sticky register panel */}
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
                  {open ? "Registration is open" : "Registration status"}
                </p>
              </div>
              <div className="p-6">
                <EventRegisterButton event={event} />
                <div className="mt-6 space-y-2 border-t border-zinc-100 pt-5 text-xs text-zinc-500">
                  <p>
                    After you register you become a{" "}
                    <strong className="text-zinc-800">PARTICIPANT</strong> and can
                    form teams + submit projects.
                  </p>
                  <p>
                    Already a participant?{" "}
                    <Link href="/participant" className="font-semibold text-violet-600">
                      Open your hub →
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

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <p className="font-display mt-1 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}
