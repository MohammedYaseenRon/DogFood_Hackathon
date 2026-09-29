import { VotingBallot } from "@/components/voting/VotingBallot";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ k?: string }>;
};

export default async function VotePage({ params, searchParams }: Props) {
  const [{ slug }, { k }] = await Promise.all([params, searchParams]);
  return <VotingBallot slug={slug} link={k ?? null} />;
}
