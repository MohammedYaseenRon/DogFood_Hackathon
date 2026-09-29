import { OrganizerGate } from "@/components/RoleGuards";
import { AuditTrail } from "@/components/voting/AuditTrail";

type Props = { params: Promise<{ slug: string }> };

export default async function AuditPage({ params }: Props) {
  const { slug } = await params;
  return (
    <OrganizerGate>
      <AuditTrail slug={slug} />
    </OrganizerGate>
  );
}
