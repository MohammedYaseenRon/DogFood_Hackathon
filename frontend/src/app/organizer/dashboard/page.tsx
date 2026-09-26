import { OrganizerDashboard } from "@/components/OrganizerDashboard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function OrganizerDashboardPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        variant="hero"
        title="Organizer dashboard"
        description="Monitor judging progress, track completion rates, and export CSV results for the entire event."
      />
      <div className="mt-8">
        <OrganizerDashboard />
      </div>
    </main>
  );
}
