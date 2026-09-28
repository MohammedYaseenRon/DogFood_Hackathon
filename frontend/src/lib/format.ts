import type { EventPhase } from "@/lib/api";

export function formatDateTime(iso?: string | null, fallback = "Not set"): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(iso?: string | null, fallback = "—"): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** "in 3 days", "2 hours ago" — coarse relative time for deadlines. */
export function relativeTime(iso?: string | null, now: number = Date.now()): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [86_400_000, "day"],
    [3_600_000, "hour"],
    [60_000, "minute"],
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [ms, unit] of units) {
    if (abs >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return diff >= 0 ? "in under a minute" : "just now";
}

export type BadgeTone = "default" | "brand" | "success" | "warning" | "danger" | "cyan";

export function phaseInfo(phase?: EventPhase): { label: string; tone: BadgeTone } {
  switch (phase) {
    case "DRAFT":
      return { label: "Draft (unpublished)", tone: "default" };
    case "REGISTRATION_OPEN":
      return { label: "Registration open", tone: "success" };
    case "REGISTRATION_CLOSED":
      return { label: "Registration closed", tone: "warning" };
    case "SUBMISSION_OPEN":
    case "LIVE":
      return { label: "Submissions open", tone: "success" };
    case "SUBMISSIONS_CLOSED":
      return { label: "Submissions closed", tone: "warning" };
    case "JUDGING":
      return { label: "Judging", tone: "brand" };
    case "COMPLETED":
      return { label: "Completed", tone: "default" };
    default:
      return { label: "Upcoming", tone: "cyan" };
  }
}

/** Convert an ISO timestamp to the value a `datetime-local` input expects (local time). */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Convert a `datetime-local` value (local time) to an ISO string in UTC. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
