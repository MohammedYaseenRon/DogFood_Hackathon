import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Countdown } from "@/components/ui/Countdown";
import type { EventInfo } from "@/lib/api";
import { formatDate, phaseInfo } from "@/lib/format";

export function EventCard({ event }: { event: EventInfo }) {
  const status = phaseInfo(event.state?.phase);
  const live = event.state.registrationOpen || event.state.submissionsOpen;

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group grid h-full overflow-hidden rounded-2xl border border-line bg-white transition duration-200 hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-[0_16px_36px_-20px_rgba(21,19,43,0.4)] sm:grid-cols-[1fr_auto]"
    >
      <div className="flex flex-col p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          {live ? <Countdown to={event.submissionsClose} /> : null}
        </div>
        <h2 className="font-display mt-5 text-2xl leading-snug font-semibold text-ink group-hover:text-brand-700">
          {event.name}
        </h2>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-zinc-600">
          {event.shortDescription || "Form a team, ship a project, and get judged before the deadline."}
        </p>
        <dl className="mt-6 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-4 font-mono text-xs text-zinc-500">
          <div className="flex gap-1.5">
            <dt>deadline</dt>
            <dd className="text-ink">{formatDate(event.submissionsClose)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>tracks</dt>
            <dd className="text-ink">{event.tracks.length}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>prizes</dt>
            <dd className="text-ink">{event.prizes.length}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>team</dt>
            <dd className="text-ink">≤{event.maxTeamSize}</dd>
          </div>
        </dl>
      </div>
      <div
        aria-hidden
        className={`hidden w-14 items-center justify-center border-l border-dashed border-line text-xl transition sm:flex ${
          live ? "bg-signal-50 text-ink group-hover:bg-signal-300" : "bg-zinc-50 text-zinc-400 group-hover:bg-zinc-100"
        }`}
      >
        →
      </div>
    </Link>
  );
}
