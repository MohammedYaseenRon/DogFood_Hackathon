import Link from "next/link";
import type { ProjectSummary } from "@/lib/api";
import { ProjectCard } from "@/components/ProjectCard";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow, MarkedTitle } from "@/components/ui/MarkedTitle";

/** The participant journey — a real sequence, so the numbers carry meaning. */
const STEPS = [
  {
    title: "Register",
    body: "Create an account and register for an event. You become a participant for that event.",
  },
  {
    title: "Form a team",
    body: "Start a team and share an invite link. Links expire, cap their uses, and can be revoked.",
  },
  {
    title: "Draft, then submit",
    body: "Drafts stay private to your team. Submit when ready and keep editing until the deadline.",
  },
  {
    title: "Get judged",
    body: "Assigned judges score on a weighted rubric. The deadline is enforced by the server, not the page.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-6 lg:py-28">
      <div className="max-w-2xl">
        <Eyebrow>How a weekend runs</Eyebrow>
        <h2 className="font-display mt-4 text-3xl leading-tight font-semibold text-ink sm:text-4xl">
          <MarkedTitle text="From sign-up to scorecard" mark="scorecard" />
        </h2>
      </div>
      <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="bg-white p-6 sm:p-7">
            <span className="font-mono text-xs font-semibold text-zinc-400">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="font-display mt-6 text-lg font-semibold text-ink">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RecentProjects({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) return null;
  return (
    <section className="border-y border-line bg-white">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Gallery</Eyebrow>
            <h2 className="font-display mt-4 text-3xl leading-tight font-semibold text-ink sm:text-4xl">
              <MarkedTitle text="Latest submissions" mark="submissions" />
            </h2>
          </div>
          <Link href="/projects" className="text-sm font-semibold text-brand-700 hover:underline">
            Browse all projects →
          </Link>
        </div>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {projects.slice(0, 8).map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ForStaff() {
  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-5 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
      <div className="rounded-2xl bg-ink p-8 text-white sm:p-10">
        <Eyebrow dark>For organizers</Eyebrow>
        <h2 className="font-display mt-5 text-2xl leading-snug font-semibold sm:text-3xl">
          Run the whole event from one screen.
        </h2>
        <ul className="mt-8 space-y-3 text-sm text-white/75">
          {[
            "Any number of events, each with its own schedule",
            "Tracks, prizes and custom submission questions",
            "Every team, draft and submission in one table",
            "Scores export to CSV per event",
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-[2px] bg-signal-300" />
              {item}
            </li>
          ))}
        </ul>
        <ButtonLink href="/organizer/dashboard" variant="signal" className="mt-10">
          Organizer dashboard
        </ButtonLink>
      </div>
      <div className="rounded-2xl border border-line bg-white p-8 sm:p-10">
        <Eyebrow>For judges</Eyebrow>
        <h2 className="font-display mt-5 text-2xl leading-snug font-semibold text-ink sm:text-3xl">
          Score only what you&apos;re assigned. See only your own scores.
        </h2>
        <ul className="mt-8 space-y-3 text-sm text-zinc-600">
          {[
            "Weighted rubric with a live total as you score",
            "Peer scores blocked by the API, not hidden by the page",
            "Progress tracked per judge for the organizer",
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-[2px] bg-ink" />
              {item}
            </li>
          ))}
        </ul>
        <ButtonLink href="/judging" variant="secondary" className="mt-10">
          Open judging
        </ButtonLink>
      </div>
    </section>
  );
}
