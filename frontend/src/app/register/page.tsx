import { CredentialAuthForm } from "@/components/CredentialAuthForm";
import { AuthPageLayout } from "@/components/ui/AuthPageLayout";

type RegisterPageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { redirect } = await searchParams;

  return (
    <AuthPageLayout
      title="Create your account"
      description="Register to join hackathons, form teams, and submit projects."
    >
      <CredentialAuthForm mode="register" redirectTo={redirect} />
    </AuthPageLayout>
  );
}
