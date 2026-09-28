import Link from "next/link";
import type { ReactNode } from "react";

export function AuthPageLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="min-h-[calc(100vh-140px)]">
      <div className="mx-auto grid max-w-6xl gap-0 overflow-hidden rounded-none lg:min-h-[calc(100vh-180px)] lg:grid-cols-5 lg:gap-8 lg:px-6 lg:py-10">
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 px-8 py-12 text-white lg:col-span-2 lg:rounded-3xl lg:py-16">
          <div className="page-dot-grid absolute inset-0 opacity-30" />
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <p className="text-xs font-bold tracking-[0.2em] text-violet-200 uppercase">
              Dogfood 2026
            </p>
            <h1 className="font-display mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-violet-100">
              {description}
            </p>
            <div className="mt-10 hidden space-y-4 lg:block">
              <Feature text="Browse public project galleries" />
              <Feature text="Register for hackathons and form teams" />
              <Feature text="Submit projects before the deadline" />
            </div>
            <Link
              href="/projects"
              className="mt-10 inline-flex items-center gap-1 text-sm font-semibold text-white/90 hover:text-white"
            >
              View gallery →
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-10 lg:col-span-3 lg:px-4 lg:py-16">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xl shadow-zinc-200/50 sm:p-8">
            {children}
          </div>
          {footer ? <div className="mt-6 text-center">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-violet-100">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs">
        ✓
      </span>
      {text}
    </div>
  );
}
