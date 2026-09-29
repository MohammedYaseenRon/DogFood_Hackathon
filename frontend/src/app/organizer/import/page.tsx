import { OrganizerGate } from "@/components/RoleGuards";
import { EventImport } from "@/components/EventImport";

export default function ImportEventPage() {
  return (
    <OrganizerGate>
      <EventImport />
    </OrganizerGate>
  );
}
