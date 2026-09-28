import { CreateTeamForm } from "@/components/CreateTeamForm";
import { ButtonLink } from "@/components/ui/Button";

export default function NewTeamPage() {
  return (
    <main className="min-h-screen bg-zinc-50/80 pb-16">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">
            Team formation
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold text-zinc-950">Create a team</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Start a new team and invite teammates with a secure link.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm">
          <CreateTeamForm redirectToTeam />
        </div>
        <div className="mt-4">
          <ButtonLink href="/participant" variant="ghost">
            ← Back to dashboard
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
