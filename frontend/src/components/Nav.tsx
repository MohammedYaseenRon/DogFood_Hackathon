"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchMeClient, logoutClient, type UserInfo } from "@/lib/api";
import { homeForRole } from "@/lib/role-auth";

const publicLinks = [
  { href: "/events", label: "Events" },
  { href: "/projects", label: "Gallery" },
];

const dashboardLabel: Record<string, string> = {
  PARTICIPANT: "My hub",
  VISITOR: "My hub",
  JUDGE: "Judging",
  ORGANIZER: "Organizer",
  ADMIN: "Admin",
};

function initials(user: UserInfo) {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg font-display text-sm font-semibold ${
          dark ? "bg-signal-300 text-ink" : "bg-ink text-signal-300"
        }`}
      >
        d
        <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ${dark ? "bg-white" : "bg-signal-300"}`} />
      </span>
      <span className={`font-display text-lg font-semibold tracking-tight ${dark ? "text-white" : "text-ink"}`}>
        dogfood
      </span>
    </span>
  );
}

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null | undefined>(undefined);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetchMeClient().then((me) => {
      if (active) setUser(me);
    });
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAccountOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  async function signOut() {
    await logoutClient();
    setUser(null);
    setAccountOpen(false);
    router.push("/");
    router.refresh();
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const home = user ? homeForRole(user.role) : null;
  const links = [
    ...publicLinks,
    ...(user && home && home !== "/events" ? [{ href: home, label: dashboardLabel[user.role] ?? "Dashboard" }] : []),
  ];
  const isAuthPage = pathname === "/login" || pathname === "/register";

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 sm:px-6">
        <Link href="/" aria-label="Dogfood home" onClick={() => setMobileOpen(false)}>
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`relative rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive(link.href) ? "text-ink" : "text-zinc-500 hover:text-ink"
              }`}
            >
              {link.label}
              {isActive(link.href) ? (
                <span aria-hidden className="absolute inset-x-3 -bottom-[13px] h-[3px] rounded-t bg-signal-300" />
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user === undefined ? (
            <span className="h-9 w-24 animate-pulse rounded-lg bg-zinc-200/70" />
          ) : user ? (
            <div ref={accountRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2.5 rounded-lg border border-line bg-white py-1 pl-1 pr-3 text-sm transition hover:border-zinc-400"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink font-mono text-[11px] font-semibold text-signal-300">
                  {initials(user)}
                </span>
                <span className="hidden max-w-[9rem] truncate font-medium text-ink sm:inline">
                  {user.name || user.email.split("@")[0]}
                </span>
                <span className="font-mono text-[10px] tracking-wider text-zinc-400 uppercase">{user.role}</span>
              </button>

              {accountOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-[0_16px_40px_-12px_rgba(21,19,43,0.25)]"
                >
                  <div className="border-b border-line px-4 py-3">
                    <p className="truncate text-sm font-semibold text-ink">{user.name || user.email}</p>
                    <p className="truncate font-mono text-xs text-zinc-500">{user.email}</p>
                  </div>
                  {[
                    { href: homeForRole(user.role), label: "My dashboard" },
                    { href: "/account", label: "Account settings" },
                    { href: "/login", label: "Switch demo role" },
                  ].map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="block px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void signOut()}
                    className="block w-full border-t border-line px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : !isAuthPage ? (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-zinc-600 hover:text-ink sm:inline-block"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Create account
              </Link>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-ink md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav aria-label="Mobile" className="border-t border-line bg-white px-5 py-3 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center justify-between rounded-lg px-3 py-3 text-base font-medium ${
                isActive(link.href) ? "bg-signal-100 text-ink" : "text-zinc-700"
              }`}
            >
              {link.label}
              <span aria-hidden>→</span>
            </Link>
          ))}
          {!user ? (
            <Link href="/login" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-3 text-base font-medium text-zinc-700">
              Sign in
            </Link>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
