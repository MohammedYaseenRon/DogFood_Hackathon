import { OrganizerGate } from "@/components/RoleGuards";
import { JudgingConsole } from "@/components/judging/JudgingConsole";

type Props = { params: Promise<{ slug: string }> };

export default async function JudgingConsolePage({ params }: Props) {
  const { slug } = await params;
  return (
    <OrganizerGate>
      <JudgingConsole slug={slug} />
    </OrganizerGate>
  );
}
