import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { PublicStats } from "@/lib/api";

export function HappeningNow({ stats }: { stats: PublicStats | null }) {
  if (!stats) return null;

  const closed = !stats.submissionsOpen;
  const closeDate = stats.submissionsClose
    ? new Date(stats.submissionsClose).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-600">
            Happening now
          </p>
          <h2 className="font-display mt-2 text-3xl font-bold text-zinc-900 sm:text-4xl">
            Active hackathon
          </h2>
        </div>
        <ButtonLink href="/event" variant="ghost" className="hidden sm:inline-flex">
          View all details →
        </ButtonLink>
      </div>

      <div className="glow-card group relative overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl transition hover:shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 via-transparent to-cyan-500/5" />

        <div className="relative flex flex-col gap-6 p-8 lg:flex-row lg:items-center lg:justify-between lg:p-10">
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-2xl font-bold text-white shadow-lg shadow-violet-500/30">
              D
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-2xl font-bold text-zinc-900">
                  {stats.eventName}
                </h3>
                <Badge tone={closed ? "warning" : "success"}>
                  {closed ? "Submissions closed" : "Live now"}
                </Badge>
              </div>
              <p className="mt-2 text-zinc-500">
                Online · Self-hostable · Open source
              </p>
              {closeDate ? (
                <p className="mt-1 text-sm text-zinc-400">
                  Submissions {closed ? "closed" : "close"} {closeDate}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/projects">View submissions</ButtonLink>
            {!closed ? (
              <ButtonLink href="/projects/new" variant="secondary">
                Submit project
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
