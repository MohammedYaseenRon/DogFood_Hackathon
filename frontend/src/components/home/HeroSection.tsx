import { ButtonLink } from "@/components/ui/Button";
import type { PublicStats } from "@/lib/api";

export function HeroSection({ stats }: { stats: PublicStats | null }) {
  return (
    <section className="hero-mesh relative -mt-[73px] overflow-hidden pt-[73px]">
      <div className="grid-overlay absolute inset-0" />

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 lg:pb-32 lg:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-violet-200 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Dogfood 2026 · 72-Hour Hackathon
          </p>

          <h1 className="animate-fade-in-up animation-delay-100 font-display mt-8 text-5xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Your portal to the{" "}
            <span className="gradient-text">best hackathons</span>
          </h1>

          <p className="animate-fade-in-up animation-delay-200 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
            {stats?.eventName
              ? `${stats.eventName} — `
              : ""}
            Self-hostable submission and judging platform. Register teams,
            submit projects, score fairly, and export results.
          </p>

          <div className="animate-fade-in-up animation-delay-300 mt-10 flex flex-wrap items-center justify-center gap-4">
            <ButtonLink href="/projects/new" size="lg" variant="white">
              Submit your project
            </ButtonLink>
            <ButtonLink href="/projects" size="lg" variant="outline">
              Browse gallery
            </ButtonLink>
          </div>
        </div>

        {/* Floating stats pills */}
        {stats ? (
          <div className="animate-fade-in-up animation-delay-400 mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center backdrop-blur-sm">
              <p className="font-display text-3xl font-bold text-white">
                {stats.projectCount}+
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-400">Projects</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center backdrop-blur-sm">
              <p className="font-display text-3xl font-bold text-white">
                {stats.trackCount}
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-400">Tracks</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-center backdrop-blur-sm">
              <p className="font-display text-3xl font-bold text-emerald-400">
                {stats.submissionsOpen ? "Open" : "Closed"}
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-400">
                Submissions
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#fafafa] to-transparent" />
    </section>
  );
}
