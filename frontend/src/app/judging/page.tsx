import { JudgingDashboard } from "@/components/JudgingDashboard";
import { PageShell } from "@/components/ui/PageShell";

export default function JudgingPage() {
  return (
    <PageShell
      tone="emerald"
      eyebrow="Judging"
      title="Judge dashboard"
      description="Review assigned projects, score with the rubric, and track your progress."
    >
      <JudgingDashboard />
    </PageShell>
  );
}
