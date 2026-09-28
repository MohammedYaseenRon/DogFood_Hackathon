import Link from "next/link";
import { LoginDemoRoles, LoginPanel } from "@/components/LoginPanel";
import { RoleSignInPanel } from "@/components/RoleSignInPanel";
import { AuthPageLayout } from "@/components/ui/AuthPageLayout";
import { Eyebrow } from "@/components/ui/MarkedTitle";
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

  return (
    <>
      <Eyebrow dark>{aside.eyebrow}</Eyebrow>
      <h2 className="font-display mt-5 text-2xl leading-tight font-semibold sm:text-3xl">
        <span className="hl hl-solid">{aside.title}</span>
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-white/70">{aside.description}</p>
      <ul className="mt-8 space-y-3 text-sm text-white/85">
        {aside.bullets.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px] bg-signal-300"
            />
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-auto pt-10 text-sm text-white/50">
        Need a different role?{" "}
        <Link href="/login" className="font-semibold text-white underline-offset-4 hover:underline">
          See all sign-in options
        </Link>
      </p>
    </>
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
