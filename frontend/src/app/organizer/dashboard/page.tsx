import { OrganizerDashboard } from "@/components/OrganizerDashboard";
import { OrganizerGate } from "@/components/RoleGuards";

export default function OrganizerDashboardPage() {
  return (
    <OrganizerGate>
      <OrganizerDashboard />
    </OrganizerGate>
  );
}
