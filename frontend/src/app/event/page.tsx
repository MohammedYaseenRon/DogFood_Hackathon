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
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title={event.name}
        description="Event configuration, tracks, and judging rubric."
        action={
          <Badge tone={closed ? "warning" : "success"}>
            {closed ? "Submissions closed" : "Submissions open"}
          </Badge>
        }
      />

      <Card className="mb-8">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">Event ID</dt>
            <dd className="font-mono text-sm text-slate-900">{event.id}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Submissions close</dt>
            <dd className="text-sm font-medium text-slate-900">
              {new Date(event.submissionsClose).toUTCString()}
            </dd>
          </div>
        </dl>
      </Card>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Tracks</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {event.tracks.map((track) => (
            <Card key={track.id} className="py-4">
              <p className="font-medium text-slate-900">{track.name}</p>
              <p className="mt-1 font-mono text-xs text-slate-400">{track.id}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-slate-900">
          Judging rubric
        </h2>
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Criterion</th>
                <th className="px-6 py-3 font-medium">Weight</th>
              </tr>
            </thead>
            <tbody>
              {event.rubric.map((criterion) => (
                <tr key={criterion.name} className="border-t border-slate-100">
                  <td className="px-6 py-3 capitalize text-slate-900">
                    {criterion.name}
                  </td>
                  <td className="px-6 py-3 text-slate-600">{criterion.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </main>
  );
}
