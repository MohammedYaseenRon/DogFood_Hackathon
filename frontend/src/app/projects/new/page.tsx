import { SubmitForm } from "@/components/SubmitForm";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchEvent } from "@/lib/api";

export default async function NewProjectPage() {
  const event = await fetchEvent();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <PageHeader
        title="Submit a project"
        description="Create a new hackathon submission for your team."
      />
      <Card>
        <SubmitForm event={event} />
      </Card>
    </main>
  );
}
