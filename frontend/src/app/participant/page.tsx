import { ParticipantDashboard } from "@/components/ParticipantDashboard";
import { Badge } from "@/components/ui/Badge";
import { fetchEvent } from "@/lib/api";

export default async function ParticipantPage() {
  const event = await fetchEvent();
  const submissionsOpen = event?.state?.submissionsOpen ?? false;

  return (
    <main className="min-h-[calc(100vh-140px)] bg-[#f8f9fb]">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-10 sm:py-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-orange-600 uppercase">
                Participant
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl font-bold text-zinc-900 sm:text-4xl">
                  Participant hub
                </h1>
                <Badge tone={submissionsOpen ? "success" : "warning"}>
                  {submissionsOpen ? "Submissions open" : "Submissions closed"}
                </Badge>
              </div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
                Join your team, submit your project, and track your hackathon
                journey.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 sm:py-10">
        <ParticipantDashboard submissionsOpen={submissionsOpen} />
      </div>
    </main>
  );
}
