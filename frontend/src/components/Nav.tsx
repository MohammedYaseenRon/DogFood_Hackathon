"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchMeClient, type UserInfo } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

const publicLinks = [
  { href: "/projects", label: "Gallery" },
  { href: "/events", label: "Events" },
];

const roleLinks = [
  {
    href: "/participant",
    label: "Participant",
    description: "Teams & submissions",
    role: "PARTICIPANT",
    tone: "warning" as const,
  },
  {
    href: "/judging",
    label: "Judging",
    description: "Score assigned projects",
    role: "JUDGE",
    tone: "success" as const,
  },
  {
    href: "/organizer/dashboard",
    label: "Organizer",
    description: "Event & judging ops",
    role: "ORGANIZER",
    tone: "brand" as const,
  },
  {
    href: "/admin",
    label: "Admin",
    description: "Platform management",
    role: "ADMIN",
    tone: "default" as const,
  },
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
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const rolesRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const isAuthPage = pathname === "/login" || pathname === "/register";

  const activeRoleLink = roleLinks.find(
    (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
  );

  useEffect(() => {
    fetchMeClient().then(setUser);
  }, [pathname]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rolesRef.current && !rolesRef.current.contains(e.target as Node)) {
        setRolesOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setAccountOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white shadow-md shadow-violet-500/25">
            D
          </span>
          <span className="font-display text-xl font-bold text-zinc-900">Dogfood</span>
        </Link>

        <div className="flex flex-1 items-center justify-end gap-1 md:justify-center">
        <nav className="hidden items-center gap-1 md:flex">
          {publicLinks.map((link) => {
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

        {!isAuthPage ? (
          <div ref={rolesRef} className="relative md:ml-0">
            <button
              type="button"
              onClick={() => {
                setRolesOpen((v) => !v);
                setAccountOpen(false);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeRoleLink || rolesOpen
                  ? "bg-violet-100 text-violet-700"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
              aria-expanded={rolesOpen}
              aria-haspopup="menu"
            >
              <span className="hidden sm:inline">
                {activeRoleLink ? activeRoleLink.label : "Roles"}
              </span>
              <span className="sm:hidden">Roles</span>
              <ChevronIcon open={rolesOpen} />
            </button>

            {rolesOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl shadow-zinc-200/50 md:left-0 md:right-auto"
              >
                <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Dashboards
                </p>
                {roleLinks.map((link) => {
                  const active =
                    pathname === link.href ||
                    pathname.startsWith(`${link.href}/`);
                  const isCurrentRole = user?.role === link.role;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      role="menuitem"
                      onClick={() => setRolesOpen(false)}
                      className={`flex items-start gap-3 px-4 py-3 transition hover:bg-zinc-50 ${
                        active ? "bg-violet-50/60" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-900">
                            {link.label}
                          </span>
                          {isCurrentRole ? (
                            <Badge tone={link.tone}>Active</Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {link.description}
                        </p>
                      </div>
                    </Link>
                  );
                })}
                <div className="my-1 border-t border-zinc-100" />
                <Link
                  href="/login"
                  role="menuitem"
                  onClick={() => setRolesOpen(false)}
                  className="block px-4 py-2.5 text-sm font-medium text-violet-600 hover:bg-violet-50"
                >
                  Switch role →
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
        </div>

        <div className="flex items-center gap-2">
          {!isAuthPage && user ? (
            <div ref={accountRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setAccountOpen((v) => !v);
                  setRolesOpen(false);
                }}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <Badge tone={roleTone[user.role] ?? "default"}>{user.role}</Badge>
                <ChevronIcon open={accountOpen} />
              </button>

              {accountOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl shadow-zinc-200/50"
                >
                  <div className="border-b border-zinc-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {user.name || user.email}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{user.email}</p>
                  </div>
                  <Link
                    href="/login"
                    role="menuitem"
                    onClick={() => setAccountOpen(false)}
                    className="block px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    Switch role
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void signOut()}
                    className="block w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : !isAuthPage ? (
            <>
              <Link
                href="/register"
                className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 sm:inline-block"
              >
                Register
              </Link>
              <Link
                href="/login"
                className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Sign in
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
