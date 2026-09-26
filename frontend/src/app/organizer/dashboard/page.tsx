import { OrganizerDashboard } from "@/components/OrganizerDashboard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function OrganizerDashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        title="Organizer dashboard"
        description="Monitor judging progress and export results for the event."
      />
      <OrganizerDashboard />
    </main>
  );
}
