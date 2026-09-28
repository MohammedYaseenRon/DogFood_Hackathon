import { LoginPanel } from "@/components/LoginPanel";
import { AuthPageLayout } from "@/components/ui/AuthPageLayout";

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect } = await searchParams;

  return (
    <AuthPageLayout
      title="Welcome back"
      description="Sign in with email or pick a demo role to explore the hackathon portal."
    >
      <p className="mb-6 text-sm text-zinc-500">
        Demo mode — pick a role or use your account
      </p>
      <LoginPanel redirectTo={redirect} />
    </AuthPageLayout>
  );
}
