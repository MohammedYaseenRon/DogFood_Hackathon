import { JudgingDashboard } from "@/components/JudgingDashboard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function JudgingPage() {
  return (
    <main className="min-h-screen bg-zinc-50/80 pb-16">
      <PageHeader
        variant="compact"
        eyebrow="Judging"
        title="Judge dashboard"
        description="Review assigned projects, score with the rubric, and track your progress."
      />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <JudgingDashboard />
      </div>
    </main>
  );
}
