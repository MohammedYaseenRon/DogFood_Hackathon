import Link from "next/link";
import { OrganizerGate } from "@/components/RoleGuards";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportsPanel } from "@/components/judging/ResultsTab";
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
        <PageShell title="Event not found">
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
            <ButtonLink href={`/organizer/events/${event.slug}/judging`} size="sm" variant="signal">
              Judging
            </ButtonLink>
            <ButtonLink href={`/organizer/events/${event.slug}/voting`} size="sm" variant="secondary">
              Voting
            </ButtonLink>
            <ButtonLink href={`/organizer/events/${event.slug}/audit`} size="sm" variant="secondary">
              Audit trail
            </ButtonLink>
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

          <div className="relative overflow-hidden rounded-2xl bg-ink text-white">
            <div aria-hidden className="graph-paper-dark absolute inset-0" />
            <dl className="relative grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-white/10">
              <Metric label="Registered" value={counts.registrations} />
              <Metric label="Teams" value={counts.teams} />
              <Metric label="Submitted" value={counts.submitted} accent />
              <Metric label="Drafts" value={counts.drafts} />
            </dl>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <PageSection title="Teams & submissions" description="Drafts are only visible here and to the team.">
              {submissions.teams.length === 0 ? (
                <EmptyState title="No teams yet" description="Teams appear as participants create them." />
              ) : (
                <Card className="overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-line text-left font-mono text-[11px] tracking-[0.12em] text-zinc-500 uppercase">
                        <tr>
                          <th className="px-5 py-3 font-medium">Team</th>
                          <th className="px-5 py-3 font-medium">Project</th>
                          <th className="px-5 py-3 font-medium">Track</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                          <th className="px-5 py-3 font-medium">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.teams.map((row) => (
                          <tr key={row.teamId} className="border-t border-line align-top transition hover:bg-zinc-50/70">
                            <td className="px-5 py-3">
                              <p className="font-semibold text-ink">{row.teamName}</p>
                              <p className="mt-0.5 text-xs text-zinc-500">
                                {row.members.map((m) => m.name).join(", ")}
                              </p>
                            </td>
                            <td className="px-5 py-3">
                              {row.project ? (
                                <Link href={`/projects/${row.project.id}`} className="font-semibold text-brand-700 underline-offset-4 hover:underline">
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
                <h2 className="font-display text-lg font-semibold text-ink">Schedule</h2>
                <ol className="relative mt-5 space-y-4 border-l border-line pl-5 text-sm">
                  {schedule.map(([label, at]) => {
                    const deadline = label === "Submission deadline";
                    return (
                      <li key={label} className="relative">
                        <span
                          aria-hidden
                          className={`absolute top-1 -left-[25px] h-2.5 w-2.5 rounded-[3px] ${
                            deadline ? "bg-signal-300 ring-2 ring-ink" : at ? "bg-ink" : "bg-zinc-300"
                          }`}
                        />
                        <p className="font-mono text-[11px] tracking-[0.12em] text-zinc-500 uppercase">{label}</p>
                        <p className={`mt-0.5 font-medium ${at ? "text-ink" : "text-zinc-400"}`}>
                          {formatDateTime(at, "Not set")}
                        </p>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-5 space-y-1.5 border-t border-dashed border-line pt-4 text-sm">
                  <StatusLine ok={event.state.registrationOpen} label="Registration" />
                  <StatusLine ok={event.state.teamFormationOpen} label="Team formation" />
                  <StatusLine ok={event.state.submissionsOpen} label="Submissions" />
                </div>
              </Card>
              <Card>
                <h2 className="font-display text-lg font-semibold text-ink">Configuration</h2>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  {[
                    ["Tracks", event.tracks.length],
                    ["Prizes", event.prizes.length],
                    ["Questions", event.questions.length],
                    ["Team size", `≤ ${event.maxTeamSize}`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-line bg-zinc-50 px-3 py-2">
                      <dt className="font-mono text-[10px] tracking-[0.12em] text-zinc-500 uppercase">{label}</dt>
                      <dd className="font-display mt-0.5 text-lg font-semibold text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
                <ButtonLink href={`/organizer/events/${event.slug}/judging`} size="sm" className="mt-5">
                  Open judging console →
                </ButtonLink>
              </Card>
              <ExportsPanel slug={event.slug} />
            </aside>
          </div>
        </div>
      </PageShell>
    </OrganizerGate>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="px-6 py-5">
      <dt className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">{label}</dt>
      <dd className={`font-display mt-2 text-3xl font-semibold tabular-nums ${accent ? "text-signal-300" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function StatusLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={`inline-flex items-center gap-1.5 font-semibold ${ok ? "text-emerald-700" : "text-zinc-400"}`}>
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-zinc-300"}`} />
        {ok ? "Open" : "Closed"}
      </span>
    </p>
  );
}
