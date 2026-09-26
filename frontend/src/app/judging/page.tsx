import { JudgingDashboard } from "@/components/JudgingDashboard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function JudgingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Judge dashboard"
        description="Review assigned projects and track your scoring progress."
      />
      <JudgingDashboard />
    </main>
  );
}
