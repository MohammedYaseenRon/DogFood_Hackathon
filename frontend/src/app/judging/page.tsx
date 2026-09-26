import { JudgingDashboard } from "@/components/JudgingDashboard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function JudgingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        variant="hero"
        title="Judge dashboard"
        description="Review assigned projects, score with the rubric, and track your progress. Peer scores are hidden by the backend."
      />
      <div className="mt-8">
        <JudgingDashboard />
      </div>
    </main>
  );
}
