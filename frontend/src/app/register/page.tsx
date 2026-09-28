import Link from "next/link";
import { RegisterDemoRoles } from "@/components/RoleSignInPanel";
import { CredentialAuthForm } from "@/components/CredentialAuthForm";
import { AuthPageLayout } from "@/components/ui/AuthPageLayout";
import { resolveLoginMode, type RoleMode } from "@/lib/role-auth";

type RegisterPageProps = {
  searchParams: Promise<{ redirect?: string; mode?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { redirect, mode } = await searchParams;
  const roleMode = resolveLoginMode(redirect, mode);

  return (
    <AuthPageLayout
      title="Create your account"
      description={
        roleMode
          ? `New accounts start as visitors. Use demo access on the right for instant ${roleMode} tools.`
          : "Join hackathons, form teams, and submit projects."
      }
      aside={
        <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <RegisterDemoRoles redirectTo={redirect} selectedMode={roleMode ?? undefined} />
          <p className="mt-8 border-t border-zinc-100 pt-6 text-sm text-zinc-400">
            Already registered?{" "}
            <Link
              href={`/login${buildQuery(redirect, roleMode)}`}
              className="font-medium text-zinc-700 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      }
    >
      <p className="mb-5 text-sm font-semibold text-zinc-800">Your details</p>
      <CredentialAuthForm
        mode="register"
        redirectTo={redirect}
        roleMode={roleMode ?? undefined}
      />
      <p className="mt-6 text-sm text-zinc-500">
        Accounts are created as <strong className="text-zinc-700">visitors</strong>.
        Register for a hackathon to become a participant, or pick a demo role on
        the right.
      </p>
    </AuthPageLayout>
  );
}

function buildQuery(redirect?: string, roleMode?: RoleMode | null) {
  const params = new URLSearchParams();
  if (redirect) params.set("redirect", redirect);
  if (roleMode) params.set("mode", roleMode);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
