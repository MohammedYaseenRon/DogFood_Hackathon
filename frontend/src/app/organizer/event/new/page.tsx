import { EventForm } from "@/components/EventForm";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/ui/PageShell";
import { fetchEvent } from "@/lib/api";
import { redirect } from "next/navigation";

export default async function NewEventPage() {
  const event = await fetchEvent();
  if (event) {
    redirect("/organizer/event/edit");
  }

  return (
    <PageShell
      tone="violet"
      eyebrow="Event setup"
      title="Create hackathon event"
      description="Configure your event name, submission deadline, tracks, and prize pool."
      action={
        <ButtonLink href="/organizer/dashboard" variant="secondary" size="sm">
          Dashboard
        </ButtonLink>
      }
    >
      <Card variant="elevated">
        <EventForm mode="create" submissionsOpen />
      </Card>
    </PageShell>
  );
}
