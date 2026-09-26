import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { fetchPublicStats } from "@/lib/api";

export default async function HomePage() {
  const stats = await fetchPublicStats();

  return (
    <main>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
            Dogfood 2026
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {stats?.eventName ?? "Hackathon Portal"}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            Self-hostable submission and judging platform. Register teams, browse
            projects, score submissions, and export results — all offline-ready.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/projects">Browse gallery</ButtonLink>
            <ButtonLink href="/event" variant="secondary">
              View event
            </ButtonLink>
            <ButtonLink href="/login" variant="ghost">
              Sign in
            </ButtonLink>
          </div>
        </div>
      </section>

      {stats ? (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Projects" value={stats.projectCount} />
            <Stat label="Tracks" value={stats.trackCount} />
            <Stat
              label="Submissions"
              value={stats.submissionsOpen ? "Open" : "Closed"}
              hint={
                stats.submissionsClose
                  ? `Closed ${new Date(stats.submissionsClose).toLocaleDateString()}`
                  : undefined
              }
            />
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Submit</h2>
            <p className="mt-2 text-sm text-slate-600">
              Participants form teams, draft projects, and submit before the
              deadline.
            </p>
            <ButtonLink href="/projects/new" variant="ghost" className="mt-4">
              Submit project →
            </ButtonLink>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Judge</h2>
            <p className="mt-2 text-sm text-slate-600">
              Judges score assigned projects with backend-enforced isolation —
              no peeking at peer scores.
            </p>
            <ButtonLink href="/judging" variant="ghost" className="mt-4">
              Open judging →
            </ButtonLink>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Export</h2>
            <p className="mt-2 text-sm text-slate-600">
              Organizers track progress and download CSV results for the entire
              event.
            </p>
            <ButtonLink
              href="/organizer/dashboard"
              variant="ghost"
              className="mt-4"
            >
              Organizer dashboard →
            </ButtonLink>
          </Card>
        </div>
      </section>
    </main>
  );
}
