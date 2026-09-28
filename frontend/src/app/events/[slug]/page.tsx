import { notFound } from "next/navigation";
import { EventRegisterButton } from "@/components/EventRegisterButton";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageSection, PageShell } from "@/components/ui/PageShell";
import { fetchEventBySlug } from "@/lib/api";

type EventSlugPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EventSlugPage({ params }: EventSlugPageProps) {
  const { slug } = await params;
  const event = await fetchEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const phase = event.state?.phase ?? "UPCOMING";

  return (
    <PageShell
      tone="blue"
      eyebrow="Hackathon"
      title={event.name}
      description={event.description || event.shortDescription || undefined}
      badge={
        <Badge tone={event.state?.submissionsOpen ? "success" : "warning"}>
          {phase.replace(/_/g, " ")}
        </Badge>
      }
      action={
        <ButtonLink href="/organizer/event/edit" variant="secondary" size="sm">
          Manage event
        </ButtonLink>
      }
    >
      <div className="space-y-10">
        <PageSection title="Register" description="Sign up to participate in this hackathon.">
          <Card variant="elevated">
            <EventRegisterButton event={event} />
          </Card>
        </PageSection>

        <PageSection title="Timeline">
          <Card variant="elevated">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {event.registrationOpens ? (
                <div className="rounded-xl bg-zinc-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Registration opens
                  </dt>
                  <dd className="mt-2 text-sm font-semibold text-zinc-900">
                    {new Date(event.registrationOpens).toLocaleString()}
                  </dd>
                </div>
              ) : null}
              {event.registrationCloses ? (
                <div className="rounded-xl bg-zinc-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Registration closes
                  </dt>
                  <dd className="mt-2 text-sm font-semibold text-zinc-900">
                    {new Date(event.registrationCloses).toLocaleString()}
                  </dd>
                </div>
              ) : null}
              <div className="rounded-xl bg-violet-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-violet-500">
                  Submissions close
                </dt>
                <dd className="mt-2 text-sm font-semibold text-zinc-900">
                  {new Date(event.submissionsClose).toLocaleString()}
                </dd>
              </div>
            </dl>
          </Card>
        </PageSection>

        {(event.prizes ?? []).length > 0 ? (
          <PageSection title="Prizes">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {event.prizes.map((prize) => (
                <Card key={prize.id}>
                  <p className="font-semibold text-zinc-900">{prize.name}</p>
                  <p className="mt-1 text-xl font-bold text-violet-600">{prize.amount}</p>
                </Card>
              ))}
            </div>
          </PageSection>
        ) : null}

        <PageSection title="Tracks">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {event.tracks.map((track) => (
              <Card key={track.id}>
                <p className="font-semibold text-zinc-900">{track.name}</p>
                {track.description ? (
                  <p className="mt-2 text-sm text-zinc-500">{track.description}</p>
                ) : null}
              </Card>
            ))}
          </div>
        </PageSection>
      </div>
    </PageShell>
  );
}
