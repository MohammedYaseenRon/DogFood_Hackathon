import { SubmitForm } from "@/components/SubmitForm";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchEvent } from "@/lib/api";

export default async function NewProjectPage() {
  const event = await fetchEvent();

  return (
    <main className="min-h-screen bg-zinc-50/80 pb-16">
      <PageHeader
        variant="compact"
        eyebrow="Submission"
        title="Submit a project"
        description="Create a new hackathon submission for your team. Sign in as a participant first."
      />
      <div className="mx-auto max-w-2xl px-6 py-8">
        <Card variant="elevated">
          <SubmitForm event={event} />
        </Card>
      </div>
    </main>
  );
}
