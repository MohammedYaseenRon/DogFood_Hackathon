"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchMeClient, type UserInfo } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

const homeLinks = [
  { href: "/projects", label: "Gallery" },
  { href: "/event", label: "Event" },
  { href: "/login", label: "About" },
];

const appLinks = [
  { href: "/projects", label: "Gallery" },
  { href: "/event", label: "Event" },
  { href: "/participant", label: "Participant" },
  { href: "/judging", label: "Judging" },
  { href: "/organizer/dashboard", label: "Organizer" },
];

const roleTone: Record<string, "brand" | "success" | "warning" | "default"> = {
  ORGANIZER: "brand",
  JUDGE: "success",
  PARTICIPANT: "warning",
  ADMIN: "brand",
};

export function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const isHome = pathname === "/";
  const links = isHome ? homeLinks : appLinks;

  useEffect(() => {
    fetchMeClient().then(setUser);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onHero = isHome && !scrolled;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        onHero
          ? "border-b border-transparent bg-white/80 backdrop-blur-md"
          : "border-b border-zinc-200/80 bg-white/95 shadow-sm backdrop-blur-xl"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3770FF] text-sm font-bold text-white shadow-md shadow-blue-500/20">
            D
          </span>
          <span className="font-display text-xl font-bold text-zinc-900">
            Dogfood
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  active
                    ? "text-[#3770FF]"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <Badge tone={roleTone[user.role] ?? "default"}>{user.role}</Badge>
          ) : null}
          {isHome ? (
            <Link
              href="/organizer/dashboard"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:inline-block"
            >
              Organize a hackathon
            </Link>
          ) : null}
          <Link
            href="/login"
            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            {user ? "Account" : "Sign in"}
          </Link>
        </div>
      </div>
    </header>
  );
}
