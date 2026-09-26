import { ButtonLink } from "@/components/ui/Button";

export function CtaSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-600 px-8 py-16 text-center shadow-2xl shadow-violet-500/25 sm:px-16">
        <div className="absolute inset-0 grid-overlay opacity-20" />
        <div className="relative">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Ready to build something great?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-violet-100">
            Join the hackathon, form your team, and submit your project before
            the deadline.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <ButtonLink href="/projects/new" variant="white" size="lg">
              Submit project
            </ButtonLink>
            <ButtonLink href="/login" variant="outline" size="lg">
              Sign in
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
