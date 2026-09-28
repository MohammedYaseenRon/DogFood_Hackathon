import Link from "next/link";
import { Logo } from "@/components/Nav";

const columns = [
  {
    title: "Explore",
    links: [
      { href: "/events", label: "Events" },
      { href: "/projects", label: "Project gallery" },
    ],
  },
  {
    title: "Take part",
    links: [
      { href: "/participant", label: "Participant hub" },
      { href: "/judging", label: "Judging" },
      { href: "/organizer/dashboard", label: "Organizer" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/register", label: "Create account" },
      { href: "/login", label: "Sign in" },
      { href: "/account", label: "Settings" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-ink text-white">
      <div aria-hidden className="graph-paper-dark absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" aria-label="Dogfood home">
              <Logo dark />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
              Open-source hackathon submission and judging. Runs on your own machine with one command.
            </p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="font-mono text-[11px] tracking-[0.14em] text-white/45 uppercase">{column.title}</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-white/80 transition hover:text-signal-300">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-white/10 pt-6 font-mono text-xs text-white/40 sm:flex-row sm:justify-between">
          <p>dogfood · built for DOGFOOD 2026 · Hackathon Raptors</p>
          <p>self-hosted · no cloud account required</p>
        </div>
      </div>
    </footer>
  );
}
