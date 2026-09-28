import { HeroWordRotator } from "@/components/home/HeroWordRotator";
import { ButtonLink } from "@/components/ui/Button";

export function HeroSection() {
  return (
    <section className="devfolio-hero relative -mt-[73px] overflow-hidden bg-white pt-[73px]">
      {/* Soft gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute -right-32 top-40 h-80 w-80 rounded-full bg-violet-100/50 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-cyan-50/80 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-16 lg:pb-28 lg:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-display text-[2.75rem] font-bold leading-[1.08] tracking-tight text-zinc-900 sm:text-6xl lg:text-[4.25rem]">
            Redefining hackathon ops
            <br />
            for <HeroWordRotator />
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-500 sm:text-xl">
            Your portal to the best hackathons. Register teams, submit projects,
            score fairly, and export results — all self-hostable.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <ButtonLink
              href="/events"
              size="lg"
              className="!bg-[#3770FF] !from-[#3770FF] !to-[#2563eb] hover:!from-[#2563eb] hover:!to-[#1d4ed8]"
            >
              Browse hackathons
            </ButtonLink>
            <ButtonLink href="/projects" variant="secondary" size="lg">
              View gallery
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
