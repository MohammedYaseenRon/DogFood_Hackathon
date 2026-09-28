import Link from "next/link";
import type { EventInfo, PublicStats } from "@/lib/api";
import { formatDateTime, phaseInfo } from "@/lib/format";
import { ButtonLink } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import { Eyebrow } from "@/components/ui/MarkedTitle";

/**
 * The thesis: a hackathon runs on a clock. The right side is a live
 * departure board for the featured event.
 */
export function HeroSection({ event, stats }: { event: EventInfo | null; stats: PublicStats | null }) {
  return (
    <section className="relative overflow-hidden bg-ink text-white">
      <div aria-hidden className="graph-paper-dark absolute inset-0" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pb-28 lg:pt-24">
        <div>
          <Eyebrow dark>Open-source hackathon portal</Eyebrow>
          <h1 className="font-display mt-6 text-[2.5rem] leading-[1.05] font-semibold tracking-tight sm:text-6xl lg:text-[4.2rem]">
            Ship before the{" "}
            <span className="hl hl-solid">clock</span>{" "}
            does.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            Register, form a team by invite link, draft and submit before a deadline that actually holds —
            then get judged on a weighted rubric. All on one self-hosted server.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href={event ? `/events/${event.slug}` : "/events"} variant="signal" size="lg">
              {event?.state.registrationOpen ? "Join the open event" : "Browse events"}
            </ButtonLink>
            <ButtonLink href="/projects" variant="outline" size="lg">
              See what got built
            </ButtonLink>
          </div>
        </div>

        {event ? <DepartureBoard event={event} stats={stats} /> : null}
      </div>
    </section>
  );
}

function DepartureBoard({ event, stats }: { event: EventInfo; stats: PublicStats | null }) {
  const phase = phaseInfo(event.state.phase);
  const rows = [
    { label: "Registration", open: event.state.registrationOpen },
    { label: "Teams", open: event.state.teamFormationOpen },
    { label: "Submissions", open: event.state.submissionsOpen },
  ];

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group block rounded-2xl border border-white/15 bg-white/[0.04] p-6 backdrop-blur-sm transition hover:border-signal-300/60 sm:p-8"
    >
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">
        <span>Now boarding</span>
        <span>{phase.label}</span>
      </div>
      <p className="font-display mt-5 text-2xl leading-snug font-semibold text-white group-hover:text-signal-300 sm:text-3xl">
        {event.name}
      </p>
      {event.shortDescription ? <p className="mt-2 text-sm text-white/60">{event.shortDescription}</p> : null}

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-6">
        <div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-white/45 uppercase">Deadline</p>
          <p className="mt-1 font-mono text-sm text-white/85">{formatDateTime(event.submissionsClose)}</p>
        </div>
        <Countdown to={event.submissionsClose} tone="dark" className="text-sm" />
      </div>

      <ul className="mt-6 grid grid-cols-3 gap-2">
        {rows.map((row) => (
          <li key={row.label} className="rounded-lg bg-white/[0.06] px-3 py-2.5">
            <p className="font-mono text-[10px] tracking-[0.12em] text-white/45 uppercase">{row.label}</p>
            <p className={`mt-1 font-mono text-sm font-semibold ${row.open ? "text-signal-300" : "text-white/40"}`}>
              {row.open ? "open" : "closed"}
            </p>
          </li>
        ))}
      </ul>

      {stats ? (
        <dl className="mt-6 grid grid-cols-3 gap-4 font-mono">
          {[
            { label: "projects", value: stats.projectCount },
            { label: "events", value: stats.eventCount },
            { label: "judges", value: stats.judgeCount },
          ].map((item) => (
            <div key={item.label}>
              <dd className="text-2xl font-semibold tabular-nums text-white">{item.value}</dd>
              <dt className="text-[11px] tracking-[0.12em] text-white/45 uppercase">{item.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
    </Link>
  );
}
