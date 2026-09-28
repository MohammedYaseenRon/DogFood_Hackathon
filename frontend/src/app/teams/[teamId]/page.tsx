import { TeamPageContent } from "@/components/TeamPageContent";

type TeamPageProps = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamPage({ params }: TeamPageProps) {
  const { teamId } = await params;
  return (
    <main className="min-h-screen bg-zinc-50/80">
      <TeamPageContent teamId={teamId} />
    </main>
  );
}
