import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchEvent } from "@/lib/api";

export default async function EventPage() {
  const event = await fetchEvent();

  if (!event) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <EmptyState
          title="No event loaded"
          description="Start the backend and seed fixtures to view event details."
        />
      </main>
    );
  }

  const closed = new Date() > new Date(event.submissionsClose);

  return (
    <main>
      <PageHeader
        variant="hero"
        title={event.name}
        description="Event configuration, tracks, and judging rubric."
        badge={
          <Badge tone={closed ? "warning" : "success"}>
            {closed ? "Submissions closed" : "Submissions open"}
          </Badge>
        }
      />

      <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <Card variant="elevated">
          <dl className="grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-zinc-400">Event ID</dt>
              <dd className="mt-1 font-mono text-sm font-semibold text-zinc-900">
                {event.id}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-zinc-400">
                Submissions close
              </dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {new Date(event.submissionsClose).toUTCString()}
              </dd>
            </div>
          </dl>
        </Card>

        <section>
          <h2 className="font-display text-xl font-bold text-zinc-900">
            Tracks
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {event.tracks.map((track) => (
              <Card
                key={track.id}
                className="transition hover:border-violet-200 hover:shadow-md"
              >
                <p className="font-semibold text-zinc-900">{track.name}</p>
                <p className="mt-1 font-mono text-xs text-zinc-400">
                  {track.id}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-zinc-900">
            Judging rubric
          </h2>
          <Card variant="elevated" className="mt-4 overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Criterion</th>
                  <th className="px-6 py-3 font-semibold">Weight</th>
                </tr>
              </thead>
              <tbody>
                {event.rubric.map((criterion) => (
                  <tr
                    key={criterion.name}
                    className="border-t border-zinc-100"
                  >
                    <td className="px-6 py-4 capitalize font-medium text-zinc-900">
                      {criterion.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                        ×{criterion.weight}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      </div>
    </main>
  );
}
