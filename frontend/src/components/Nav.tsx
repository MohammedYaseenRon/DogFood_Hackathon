"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchMeClient, type UserInfo } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

const links = [
  { href: "/projects", label: "Gallery" },
  { href: "/event", label: "Event" },
  { href: "/projects/new", label: "Submit" },
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

  useEffect(() => {
    fetchMeClient().then(setUser);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            D
          </span>
          <span className="text-lg font-bold text-slate-900">Dogfood</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
          <Link
            href="/login"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {user ? "Account" : "Login"}
          </Link>
        </div>
      </div>
    </header>
  );
}
