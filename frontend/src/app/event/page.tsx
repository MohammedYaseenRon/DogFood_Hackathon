import { EventRegisterButton } from "@/components/EventRegisterButton";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSection, PageShell } from "@/components/ui/PageShell";
import { fetchEvent } from "@/lib/api";

export default async function EventPage() {
  const event = await fetchEvent();

  if (!event) {
    return (
      <PageShell tone="blue" title="Event" description="No event loaded.">
        <EmptyState
          title="No event loaded"
          description="Start the backend and seed fixtures to view event details."
        />
      </PageShell>
    );
  }

  const closed = !event.state?.submissionsOpen;
  const slug = event.slug || event.id;

  return (
    <PageShell
      tone="blue"
      eyebrow="Event"
      title={event.name}
      description={event.shortDescription || "Event configuration, tracks, prizes, and judging rubric."}
      badge={
        <Badge tone={closed ? "warning" : "success"}>
          {closed ? "Submissions closed" : "Submissions open"}
        </Badge>
      }
      action={
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/events/${slug}`} variant="secondary" size="sm">
            Public page
          </ButtonLink>
          <ButtonLink href="/organizer/event/edit" variant="secondary" size="sm">
            Manage event
          </ButtonLink>
        </div>
      }
    >
      <div className="space-y-10">
        <PageSection title="Registration" description="Join the hackathon to create a team and submit.">
          <Card variant="elevated">
            <EventRegisterButton event={event} />
          </Card>
        </PageSection>

        <PageSection title="Event details">
          <Card variant="elevated">
            <dl className="grid gap-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-zinc-400">Event ID</dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-zinc-900">
                  {event.id}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-zinc-400">Submissions close</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900">
                  {new Date(event.submissionsClose).toUTCString()}
                </dd>
              </div>
            </dl>
          </Card>
        </PageSection>

        {(event.prizes ?? []).length > 0 ? (
          <PageSection title="Prizes">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(event.prizes ?? []).map((prize) => (
                <Card key={prize.id} className="hover:border-violet-200">
                  <p className="font-semibold text-zinc-900">{prize.name}</p>
                  <p className="mt-1 text-xl font-bold text-violet-600">{prize.amount}</p>
                  <p className="mt-2 text-xs text-zinc-400">
                    {prize.trackName ? `Track: ${prize.trackName}` : "Overall"}
                  </p>
                </Card>
              ))}
            </div>
          </PageSection>
        ) : null}

        <PageSection title="Tracks">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {event.tracks.map((track) => (
              <Card key={track.id} className="hover:border-violet-200">
                <p className="font-semibold text-zinc-900">{track.name}</p>
                {track.description ? (
                  <p className="mt-2 text-sm text-zinc-500">{track.description}</p>
                ) : (
                  <p className="mt-1 font-mono text-xs text-zinc-400">{track.id}</p>
                )}
              </Card>
            ))}
          </div>
        </PageSection>

        <PageSection title="Judging rubric">
          <Card variant="elevated" className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Criterion</th>
                  <th className="px-6 py-3 font-semibold">Weight</th>
                </tr>
              </thead>
              <tbody>
                {event.rubric.map((criterion) => (
                  <tr key={criterion.name} className="border-t border-zinc-100">
                    <td className="px-6 py-4 font-medium capitalize text-zinc-900">
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
        </PageSection>
      </div>
    </PageShell>
  );
}
