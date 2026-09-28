export type RoleMode = "participant" | "organizer" | "judge" | "admin";

export type RoleAuthConfig = {
  mode: RoleMode;
  role: string;
  label: string;
  sessionKey: string;
  defaultRedirect: string;
  icon: string;
  iconBg: string;
  hoverBorder: string;
  description: string;
};

export const ROLE_AUTH: Record<RoleMode, RoleAuthConfig> = {
  participant: {
    mode: "participant",
    role: "PARTICIPANT",
    label: "Participant",
    sessionKey: "prt_2e88",
    defaultRedirect: "/participant",
    icon: "P",
    iconBg: "bg-amber-500",
    hoverBorder: "hover:border-amber-200 hover:bg-amber-50/40",
    description: "Instant access with a pre-seeded team",
  },
  organizer: {
    mode: "organizer",
    role: "ORGANIZER",
    label: "Organizer",
    sessionKey: "org_7f2a",
    defaultRedirect: "/organizer/dashboard",
    icon: "O",
    iconBg: "bg-zinc-900",
    hoverBorder: "hover:border-zinc-300 hover:bg-zinc-50",
    description: "Instant access to event setup and judging ops",
  },
  judge: {
    mode: "judge",
    role: "JUDGE",
    label: "Judge",
    sessionKey: "jdg_a_91bc",
    defaultRedirect: "/judging",
    icon: "J",
    iconBg: "bg-emerald-600",
    hoverBorder: "hover:border-emerald-200 hover:bg-emerald-50/40",
    description: "Score assigned projects with demo judge account",
  },
  admin: {
    mode: "admin",
    role: "ADMIN",
    label: "Admin",
    sessionKey: "adm_3c91",
    defaultRedirect: "/admin",
    icon: "A",
    iconBg: "bg-zinc-700",
    hoverBorder: "hover:border-zinc-300 hover:bg-zinc-50",
    description: "Full platform access including event setup",
  },
};

export function resolveLoginMode(
  redirect?: string,
  mode?: string,
): RoleMode | null {
  if (mode && mode in ROLE_AUTH) {
    return mode as RoleMode;
  }
  if (!redirect) return null;
  if (
    redirect.startsWith("/participant") ||
    redirect.startsWith("/projects/new") ||
    redirect.startsWith("/teams")
  ) {
    return "participant";
  }
  if (redirect.startsWith("/organizer")) return "organizer";
  if (redirect.startsWith("/judging")) return "judge";
  if (redirect.startsWith("/admin")) return "admin";
  return null;
}

export function loginHref(redirect: string, mode?: RoleMode) {
  const params = new URLSearchParams({ redirect });
  if (mode) params.set("mode", mode);
  return `/login?${params.toString()}`;
}

export function registerHref(redirect?: string, mode?: RoleMode) {
  const params = new URLSearchParams();
  if (redirect) params.set("redirect", redirect);
  if (mode) params.set("mode", mode);
  const qs = params.toString();
  return qs ? `/register?${qs}` : "/register";
}

/**
 * Only allow same-site relative paths as post-login destinations, so a crafted
 * `?redirect=https://evil.example` link can't bounce users off-site.
 */
export function safeRedirect(target?: string | null, fallback = "/"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return fallback;
  }
  return target;
}

/** Where each role lands after signing in when no redirect was requested. */
export function homeForRole(role?: string | null): string {
  switch (role) {
    case "PARTICIPANT":
      return "/participant";
    case "ORGANIZER":
      return "/organizer/dashboard";
    case "ADMIN":
      return "/admin";
    case "JUDGE":
      return "/judging";
    default:
      return "/events";
  }
}

/** Roles allowed to open each protected area, used to avoid redirect dead-ends. */
export function canAccess(path: string, role?: string | null): boolean {
  if (path.startsWith("/participant") || path.startsWith("/projects/new") || path.startsWith("/teams")) {
    return role === "PARTICIPANT" || role === "VISITOR";
  }
  if (path.startsWith("/organizer")) return role === "ORGANIZER" || role === "ADMIN";
  if (path.startsWith("/judging")) return role === "JUDGE";
  if (path.startsWith("/admin")) return role === "ADMIN";
  return true;
}
