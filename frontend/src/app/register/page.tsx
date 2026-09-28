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
        <>
          <RegisterDemoRoles redirectTo={redirect} selectedMode={roleMode ?? undefined} />
          <p className="mt-auto border-t border-white/10 pt-6 text-sm text-white/50">
            Already registered?{" "}
            <Link
              href={`/login${buildQuery(redirect, roleMode)}`}
              className="font-semibold text-white underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </>
      }
    >
      <p className="mb-5 font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">Your details</p>
      <CredentialAuthForm
        mode="register"
        redirectTo={redirect}
        roleMode={roleMode ?? undefined}
      />
      <p className="mt-6 text-sm text-zinc-500">
        Accounts are created as <strong className="font-semibold text-ink">visitors</strong>.
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
