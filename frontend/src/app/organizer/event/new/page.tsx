import { EventForm } from "@/components/EventForm";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchEvent } from "@/lib/api";
import { redirect } from "next/navigation";

export default async function NewEventPage() {
  const event = await fetchEvent();
  if (event) {
    redirect("/organizer/event/edit");
  }

  return (
    <main>
      <PageHeader
        variant="hero"
        title="Create hackathon event"
        description="Configure event dates, tracks, and prizes. Organizer or admin access required."
      />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Card variant="elevated">
          <EventForm mode="create" />
        </Card>
      </div>
    </main>
  );
}
