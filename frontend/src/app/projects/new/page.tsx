import { SubmitForm } from "@/components/SubmitForm";
import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/ui/PageShell";
import { fetchEvent } from "@/lib/api";

export default async function NewProjectPage() {
  const event = await fetchEvent();

  return (
    <PageShell
      tone="violet"
      eyebrow="Submission"
      title="Submit a project"
      description="Create a new hackathon submission for your team. Sign in as a participant first."
      maxWidth="max-w-3xl"
    >
      <Card variant="elevated">
        <SubmitForm event={event} />
      </Card>
    </PageShell>
  );
}
