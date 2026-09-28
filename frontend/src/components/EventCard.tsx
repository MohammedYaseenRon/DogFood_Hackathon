import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { EventInfo } from "@/lib/api";
import { formatDate, phaseInfo } from "@/lib/format";

function bannerGradient(name: string) {
  const palettes = [
    "from-violet-600 via-indigo-600 to-blue-600",
    "from-fuchsia-600 via-violet-600 to-indigo-600",
    "from-cyan-600 via-blue-600 to-indigo-600",
    "from-emerald-600 via-teal-600 to-cyan-600",
  ];
  const index = name.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return palettes[index % palettes.length];
}

export function EventCard({ event }: { event: EventInfo }) {
  const status = phaseInfo(event.state?.phase);
  const slug = event.slug || event.id;
  const gradient = bannerGradient(event.name);

  return (
    <Link href={`/events/${slug}`} className="group block">
      <article className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-100/50">
        <div className={`relative h-40 bg-gradient-to-br ${gradient} px-6 py-5 sm:h-44`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
          <div className="absolute inset-0 bg-black/10 opacity-0 transition group-hover:opacity-100" />
          <div className="relative flex items-start justify-between gap-3">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              Hackathon
            </span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <h2 className="relative mt-6 font-display text-2xl font-bold text-white sm:text-3xl">
            {event.name}
          </h2>
        </div>

        <div className="p-6">
          {event.shortDescription ? (
            <p className="line-clamp-2 text-sm leading-relaxed text-zinc-600">
              {event.shortDescription}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">
              Join builders, form teams, and ship projects before the deadline.
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
              <TrackIcon />
              {event.tracks.length} tracks
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700">
              <CalendarIcon />
              Deadline {formatDate(event.submissionsClose)}
            </span>
            {(event.prizes ?? []).length > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                <TrophyIcon />
                {(event.prizes ?? []).length} prizes
              </span>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-5">
            <span className="text-sm font-semibold text-violet-600 transition group-hover:text-violet-800">
              View event details
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-600 transition group-hover:bg-violet-600 group-hover:text-white">
              →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function TrackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
