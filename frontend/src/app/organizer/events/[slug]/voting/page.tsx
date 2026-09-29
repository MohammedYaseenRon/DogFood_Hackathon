import { OrganizerGate } from "@/components/RoleGuards";
import { VotingConsole } from "@/components/voting/VotingConsole";

type Props = { params: Promise<{ slug: string }> };

export default async function VotingConsolePage({ params }: Props) {
  const { slug } = await params;
  return (
    <OrganizerGate>
      <VotingConsole slug={slug} />
    </OrganizerGate>
  );
}
