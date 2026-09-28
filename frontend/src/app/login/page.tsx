import Link from "next/link";
import { LoginPanel } from "@/components/LoginPanel";

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect } = await searchParams;
  return (
    <main className="min-h-[calc(100vh-140px)] bg-[#fafafa]">
      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-5 lg:py-16">
        {/* Branding */}
        <div className="lg:col-span-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#3770FF]">
            Dogfood 2026
          </p>
          <h1 className="font-display mt-3 text-3xl font-bold leading-tight text-zinc-900 sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-500">
            Choose a role to explore the hackathon portal. Each demo account
            opens the dashboard for that role.
          </p>

          <div className="mt-8 hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:block">
            <p className="text-sm font-semibold text-zinc-900">
              Just browsing?
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              The project gallery is public — no sign-in required.
            </p>
            <Link
              href="/projects"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#3770FF] hover:text-blue-700"
            >
              View gallery →
            </Link>
          </div>
        </div>

        {/* Role picker */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="mb-6 text-sm text-zinc-500">
              Demo mode — pick a role to continue
            </p>
            <LoginPanel redirectTo={redirect} />
          </div>

          <p className="mt-6 text-center text-sm text-zinc-400 lg:hidden">
            Just browsing?{" "}
            <Link href="/projects" className="font-semibold text-[#3770FF]">
              View the gallery
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
