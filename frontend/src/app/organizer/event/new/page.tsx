import { EventSetupForm } from "@/components/EventSetupForm";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NewEventPage() {
  return (
    <main>
      <PageHeader
        variant="hero"
        title="Create hackathon event"
        description="Configure event dates, tracks, and prizes. Organizer or admin access required."
      />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Card variant="elevated">
          <EventSetupForm />
        </Card>
      </div>
    </main>
  );
}
