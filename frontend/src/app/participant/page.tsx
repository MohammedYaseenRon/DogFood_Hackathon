import { ParticipantDashboard } from "@/components/ParticipantDashboard";

export default function ParticipantPage() {
  return (
    <main className="min-h-[calc(100vh-140px)] bg-[#f8f9fb]">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-10 sm:py-12">
          <p className="text-xs font-bold tracking-[0.2em] text-orange-600 uppercase">Participant</p>
          <h1 className="font-display mt-2 text-3xl font-bold text-zinc-900 sm:text-4xl">
            Participant hub
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
            Your events, teams and submissions in one place.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 sm:py-10">
        <ParticipantDashboard />
      </div>
    </main>
  );
}
