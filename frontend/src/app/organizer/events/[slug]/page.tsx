import Link from "next/link";
import { OrganizerGate } from "@/components/RoleGuards";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSection, PageShell } from "@/components/ui/PageShell";
import { formatDateTime, phaseInfo } from "@/lib/format";
import { fetchEventBySlug, fetchEventSubmissions } from "@/lib/server-api";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export default async function OrganizerEventPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { saved } = await searchParams;
  const [event, submissions] = await Promise.all([fetchEventBySlug(slug), fetchEventSubmissions(slug)]);

  if (!event || !submissions) {
    return (
      <OrganizerGate>
        <PageShell tone="slate" title="Event not found">
          <EmptyState
            title="No event at this address"
            description="Pick an event from the organizer dashboard."
            action={<ButtonLink href="/organizer/dashboard">Organizer dashboard</ButtonLink>}
          />
        </PageShell>
      </OrganizerGate>
    );
  }

  const phase = phaseInfo(event.state.phase);
  const { counts } = submissions;
  const schedule = [
    ["Registration opens", event.registrationOpens],
    ["Registration closes", event.registrationCloses],
    ["Hacking starts", event.eventStarts],
    ["Hacking ends", event.eventEnds],
    ["Submission deadline", event.submissionsClose],
    ["Judging starts", event.judgingStarts],
    ["Judging ends", event.judgingEnds],
    ["Results", event.resultsAt],
  ] as const;

  return (
    <OrganizerGate>
      <PageShell
        tone="violet"
        eyebrow="Organizer · Event"
        title={event.name}
        description={event.shortDescription ?? undefined}
        badge={
          <>
            <Badge tone={phase.tone}>{phase.label}</Badge>
            {!event.published ? <Badge tone="warning">Hidden</Badge> : null}
          </>
        }
        action={
          <>
            <ButtonLink href={`/organizer/events/${event.slug}/edit`} size="sm">
              Edit event
            </ButtonLink>
            <ButtonLink href={`/events/${event.slug}`} variant="secondary" size="sm">
              Public page
            </ButtonLink>
            <ButtonLink href={`/projects?event=${event.slug}`} variant="secondary" size="sm">
              Gallery
            </ButtonLink>
            <ButtonLink href="/organizer/dashboard" variant="ghost" size="sm">
              ← Dashboard
            </ButtonLink>
          </>
        }
      >
        <div className="space-y-10">
          {saved ? <Alert tone="success">Event saved.</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Registered" value={counts.registrations} />
            <Metric label="Teams" value={counts.teams} />
            <Metric label="Submitted" value={counts.submitted} />
            <Metric label="Drafts" value={counts.drafts} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <PageSection title="Teams & submissions" description="Drafts are only visible here and to the team.">
              {submissions.teams.length === 0 ? (
                <EmptyState title="No teams yet" description="Teams appear as participants create them." />
              ) : (
                <Card variant="elevated" className="overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 text-left text-zinc-500">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Team</th>
                          <th className="px-5 py-3 font-semibold">Project</th>
                          <th className="px-5 py-3 font-semibold">Track</th>
                          <th className="px-5 py-3 font-semibold">Status</th>
                          <th className="px-5 py-3 font-semibold">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.teams.map((row) => (
                          <tr key={row.teamId} className="border-t border-zinc-100 align-top">
                            <td className="px-5 py-3">
                              <p className="font-semibold text-zinc-900">{row.teamName}</p>
                              <p className="mt-0.5 text-xs text-zinc-500">
                                {row.members.map((m) => m.name).join(", ")}
                              </p>
                            </td>
                            <td className="px-5 py-3">
                              {row.project ? (
                                <Link href={`/projects/${row.project.id}`} className="font-medium text-violet-700 hover:underline">
                                  {row.project.title || "Untitled"}
                                </Link>
                              ) : (
                                <span className="text-zinc-400">No project</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-zinc-600">{row.project?.trackName ?? "—"}</td>
                            <td className="px-5 py-3">
                              {row.project ? (
                                <Badge tone={row.project.status === "SUBMITTED" ? "success" : "warning"}>
                                  {row.project.status === "SUBMITTED" ? "Submitted" : "Draft"}
                                </Badge>
                              ) : (
                                <Badge>Not started</Badge>
                              )}
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap text-zinc-500">
                              {row.project ? formatDateTime(row.project.updatedAt ?? row.project.submittedAt, "—") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </PageSection>

            <aside className="space-y-6">
              <Card>
                <h2 className="font-display text-lg font-bold text-zinc-900">Schedule</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  {schedule.map(([label, at]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-zinc-500">{label}</dt>
                      <dd className="text-right font-medium text-zinc-900">{formatDateTime(at, "—")}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 space-y-1.5 border-t border-zinc-100 pt-4 text-sm">
                  <StatusLine ok={event.state.registrationOpen} label="Registration" />
                  <StatusLine ok={event.state.teamFormationOpen} label="Team formation" />
                  <StatusLine ok={event.state.submissionsOpen} label="Submissions" />
                </div>
              </Card>
              <Card>
                <h2 className="font-display text-lg font-bold text-zinc-900">Configuration</h2>
                <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                  <li>{event.tracks.length} tracks</li>
                  <li>{event.prizes.length} prizes</li>
                  <li>{event.questions.length} submission questions</li>
                  <li>Teams of up to {event.maxTeamSize}</li>
                </ul>
                <a
                  href={`/api/export.csv?event=${event.slug}`}
                  className="mt-5 inline-flex text-sm font-semibold text-violet-700 hover:underline"
                >
                  Download scores CSV →
                </a>
              </Card>
            </aside>
          </div>
        </div>
      </PageShell>
    </OrganizerGate>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">{label}</p>
      <p className="font-display mt-3 text-3xl font-bold text-zinc-950">{value}</p>
    </div>
  );
}

function StatusLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={`font-semibold ${ok ? "text-emerald-600" : "text-zinc-400"}`}>{ok ? "Open" : "Closed"}</span>
    </p>
  );
}
