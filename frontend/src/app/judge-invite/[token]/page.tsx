import { JudgeInviteAccept } from "@/components/JudgeInviteAccept";

type Props = { params: Promise<{ token: string }> };

export default async function JudgeInvitePage({ params }: Props) {
  const { token } = await params;
  return <JudgeInviteAccept token={token} />;
}
