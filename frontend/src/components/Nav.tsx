"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchMeClient, type UserInfo } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

const publicLinks = [
  { href: "/projects", label: "Gallery" },
  { href: "/events", label: "Events" },
];

const roleLinks = [
  { href: "/participant", label: "Participant" },
  { href: "/judging", label: "Judging" },
  { href: "/organizer/dashboard", label: "Organizer" },
  { href: "/admin", label: "Admin" },
];

const roleTone: Record<string, "brand" | "success" | "warning" | "default"> = {
  ORGANIZER: "brand",
  JUDGE: "success",
  PARTICIPANT: "warning",
  ADMIN: "default",
  VISITOR: "default",
};

export function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const isHome = pathname === "/";
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const links = isHome ? publicLinks : [...publicLinks, ...roleLinks];

  useEffect(() => {
    fetchMeClient().then(setUser);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white shadow-md shadow-violet-500/25">
            D
          </span>
          <span className="font-display text-xl font-bold text-zinc-900">Dogfood</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-violet-100 text-violet-700"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          {user && !isAuthPage ? (
            <Badge tone={roleTone[user.role] ?? "default"}>{user.role}</Badge>
          ) : null}
          {!isAuthPage ? (
            <Link
              href={user ? "/login" : "/register"}
              className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 sm:inline-block"
            >
              {user ? "Switch role" : "Register"}
            </Link>
          ) : null}
          {!isAuthPage ? (
            <Link
              href="/login"
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              {user ? "Account" : "Sign in"}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
