import Link from "next/link";
import { LoginDemoRoles, LoginPanel } from "@/components/LoginPanel";
import { RoleSignInPanel } from "@/components/RoleSignInPanel";
import { AuthPageLayout } from "@/components/ui/AuthPageLayout";
import {
  ROLE_AUTH,
  resolveLoginMode,
  type RoleMode,
} from "@/lib/role-auth";

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string; mode?: string }>;
};

const ROLE_ASIDE: Record<
  RoleMode,
  { eyebrow: string; title: string; description: string; bullets: string[] }
> = {
  participant: {
    eyebrow: "Hackathon access",
    title: "Built for builders",
    description:
      "Sign in to join teams, submit projects before the deadline, and track your hackathon progress.",
    bullets: [
      "Browse public project galleries",
      "Register for hackathons and form teams",
      "Submit projects before the deadline",
    ],
  },
  organizer: {
    eyebrow: "Organizer tools",
    title: "Run the hackathon",
    description:
      "Configure events, monitor judging progress, and export results when scoring wraps up.",
    bullets: [
      "Set submission deadlines and tracks",
      "Manage prizes and event settings",
      "Monitor judge progress and exports",
    ],
  },
  judge: {
    eyebrow: "Judging",
    title: "Score submissions",
    description:
      "Review assigned projects and submit scores with backend-enforced isolation between judges.",
    bullets: [
      "See only your assigned projects",
      "Submit scores with rubric guidance",
      "Peer isolation enforced by the backend",
    ],
  },
  admin: {
    eyebrow: "Platform admin",
    title: "Full platform access",
    description:
      "Manage events, users, and platform configuration with the highest access level.",
    bullets: [
      "Create and edit hackathon events",
      "Access all organizer and admin tools",
      "Use demo admin for instant access",
    ],
  },
};

function RoleAside({ roleMode }: { roleMode: RoleMode }) {
  const aside = ROLE_ASIDE[roleMode];
  const accent =
    roleMode === "participant"
      ? "text-amber-600"
      : roleMode === "judge"
        ? "text-emerald-600"
        : "text-zinc-600";

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
      <div>
        <p className={`text-xs font-bold tracking-[0.16em] uppercase ${accent}`}>
          {aside.eyebrow}
        </p>
        <h2 className="font-display mt-2 text-2xl font-semibold text-zinc-900">
          {aside.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          {aside.description}
        </p>
        <ul className="mt-6 space-y-3 text-sm text-zinc-600">
          {aside.bullets.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-8 text-sm text-zinc-400">
        Need a different role?{" "}
        <Link href="/login" className="font-medium text-zinc-700 hover:underline">
          Full login
        </Link>
      </p>
    </div>
  );
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect, mode } = await searchParams;
  const roleMode = resolveLoginMode(redirect, mode);

  if (roleMode) {
    const config = ROLE_AUTH[roleMode];
    return (
      <AuthPageLayout
        title={`${config.label} sign in`}
        description={`Access the ${config.label.toLowerCase()} dashboard and tools.`}
        aside={<RoleAside roleMode={roleMode} />}
      >
        <RoleSignInPanel
          roleMode={roleMode}
          redirectTo={redirect || config.defaultRedirect}
        />
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout
      title="Sign in"
      description="Use your account, or pick a demo role to explore the portal."
      aside={<LoginDemoRoles redirectTo={redirect} />}
    >
      <LoginPanel redirectTo={redirect} />
    </AuthPageLayout>
  );
}
