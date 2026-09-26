import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 text-sm font-bold text-white">
                D
              </span>
              <span className="font-display text-xl font-bold text-zinc-900">
                Dogfood
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-500">
              Self-hostable hackathon submission and judging platform. Built for
              Dogfood 2026 — open source, offline-ready, production-grade.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Platform</h3>
            <ul className="mt-4 space-y-3 text-sm text-zinc-500">
              <li>
                <Link href="/projects" className="hover:text-violet-600">
                  Project gallery
                </Link>
              </li>
              <li>
                <Link href="/event" className="hover:text-violet-600">
                  Event details
                </Link>
              </li>
              <li>
                <Link href="/projects/new" className="hover:text-violet-600">
                  Submit project
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Roles</h3>
            <ul className="mt-4 space-y-3 text-sm text-zinc-500">
              <li>
                <Link href="/participant" className="hover:text-violet-600">
                  Participant
                </Link>
              </li>
              <li>
                <Link href="/judging" className="hover:text-violet-600">
                  Judge
                </Link>
              </li>
              <li>
                <Link href="/organizer/dashboard" className="hover:text-violet-600">
                  Organizer
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-violet-600">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-zinc-100 pt-8 sm:flex-row">
          <p className="text-sm text-zinc-400">
            © 2026 Dogfood · Hackathon Raptors
          </p>
          <p className="text-sm text-zinc-400">
            Built with Next.js · Self-hostable · Open source
          </p>
        </div>
      </div>
    </footer>
  );
}
