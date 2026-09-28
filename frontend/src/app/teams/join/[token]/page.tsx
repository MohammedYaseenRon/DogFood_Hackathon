import { redirect } from "next/navigation";

type LegacyJoinPageProps = {
  params: Promise<{ token: string }>;
};

export default async function LegacyJoinTeamPage({ params }: LegacyJoinPageProps) {
  const { token } = await params;
  redirect(`/join/${token}`);
}
