import { JoinTeamPanel } from "@/components/JoinTeamPanel";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageShell } from "@/components/ui/PageShell";
import { formatDateTime } from "@/lib/format";
import { fetchInvitePreview } from "@/lib/server-api";

type JoinPageProps = {
  params: Promise<{ token: string }>;
};

export default async function JoinTeamPage({ params }: JoinPageProps) {
  const { token } = await params;
  const preview = await fetchInvitePreview(token);

  if (!preview) {
    return (
      <PageShell
        title="Invitation unavailable"
        description="This invite link is invalid, expired, revoked, or has reached its usage limit."
        maxWidth="max-w-xl"
      >
        <EmptyState
          title="Link not valid"
          description="Ask your team owner to generate a new invite link."
          action={
            <ButtonLink href="/participant" variant="primary">
              Go to dashboard
            </ButtonLink>
          }
        />
      </PageShell>
    );
  }

  const { team } = preview;
  const seats = Array.from({ length: team.maxTeamSize }, (_, i) => preview.members[i] ?? null);
  const full = team.memberCount >= team.maxTeamSize;

  return (
    <PageShell
      eyebrow="Team invitation"
      title={`Join ${team.name}`}
      mark={team.name}
      description={
        preview.event
          ? `You've been invited to join this team for ${preview.event.name}.`
          : "You've been invited to collaborate on this hackathon team."
      }
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6">
        <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white md:flex-row">
          <div className="flex-1 p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
              Admit one · {preview.event?.name ?? "Hackathon team"}
            </p>
            <h2 className="font-display mt-3 text-2xl font-semibold text-ink">{team.name}</h2>

            <p className="mt-6 font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Seats</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {seats.map((member, index) =>
                member ? (
                  <li
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm"
                  >
                    <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink text-xs font-semibold text-white">
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{member.name}</span>
                    {member.role === "OWNER" ? (
                      <span className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">Owner</span>
                    ) : null}
                  </li>
                ) : (
                  <li
                    key={`open-${index}`}
                    className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-300 px-3 py-2.5 text-sm text-zinc-400"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-300">
                      +
                    </span>
                    {index === team.memberCount ? (
                      <span className="font-medium text-ink">
                        <span className="hl">Your seat</span>
                      </span>
                    ) : (
                      "Open seat"
                    )}
                  </li>
                ),
              )}
            </ul>

            <div className="mt-8 border-t border-line pt-6">
              <JoinTeamPanel token={token} teamName={team.name} teamId={team.id} />
            </div>
          </div>

          <aside className="ticket-tear flex shrink-0 flex-row items-center justify-between gap-6 bg-zinc-50 p-6 md:w-52 md:flex-col md:items-start md:justify-center">
            <div>
              <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Members</p>
              <p className="font-display mt-1 text-4xl font-semibold text-ink tabular-nums">
                {team.memberCount}
                <span className="text-xl text-zinc-400">/{team.maxTeamSize}</span>
              </p>
            </div>
            {preview.remainingUses != null ? (
              <div>
                <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Uses left</p>
                <p className="font-display mt-1 text-2xl font-semibold text-ink">{preview.remainingUses}</p>
              </div>
            ) : null}
            {preview.expiresAt ? (
              <div>
                <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Expires</p>
                <p className="mt-1 text-sm font-semibold text-ink">{formatDateTime(preview.expiresAt)}</p>
              </div>
            ) : null}
          </aside>
        </article>

        {preview.event && !preview.event.teamFormationOpen ? (
          <Alert tone="warning" title="Team formation is closed">
            {preview.event.name} stopped accepting team changes (deadline{" "}
            {formatDateTime(preview.event.submissionsClose)}).
          </Alert>
        ) : null}
        {full ? (
          <Alert tone="warning" title="This team is full">
            Ask the team owner to make room, or create your own team.
          </Alert>
        ) : null}
      </div>
    </PageShell>
  );
}
