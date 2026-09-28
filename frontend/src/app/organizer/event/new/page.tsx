import { EventForm } from "@/components/EventForm";
import { ButtonLink } from "@/components/ui/Button";
import { fetchEvent } from "@/lib/api";
import { redirect } from "next/navigation";

export default async function NewEventPage() {
  const event = await fetchEvent();
  if (event) {
    redirect("/organizer/event/edit");
  }

  return (
    <main className="min-h-screen bg-zinc-50/80 pb-20">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">
              Event setup
            </p>
            <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-zinc-950">
              Create hackathon event
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
              Configure your event name, submission deadline, tracks, and prize
              pool before participants start submitting.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/organizer/dashboard" variant="secondary" size="sm">
              Dashboard
            </ButtonLink>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <EventForm mode="create" submissionsOpen />
      </div>
    </main>
  );
}
