import Link from "next/link";
import { LoginPanel } from "@/components/LoginPanel";
import { ParticipantSignInPanel } from "@/components/ParticipantSignInPanel";
import { AuthPageLayout } from "@/components/ui/AuthPageLayout";

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string; mode?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect, mode } = await searchParams;
  const participantOnly =
    mode === "participant" || redirect === "/participant";

  if (participantOnly) {
    return (
      <AuthPageLayout
        title="Participant sign in"
        description="Access your team, submissions, and hackathon dashboard."
        footer={
          <p className="text-sm text-zinc-400">
            Need another role?{" "}
            <Link href="/login" className="font-medium text-zinc-600 hover:underline">
              Full login
            </Link>
          </p>
        }
      >
        <ParticipantSignInPanel redirectTo={redirect || "/participant"} />
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      title="Sign in"
      description="Use your account or pick a demo role."
    >
      <LoginPanel redirectTo={redirect} />
    </AuthPageLayout>
  );
}
