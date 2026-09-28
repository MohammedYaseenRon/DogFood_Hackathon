"use client";

import { useSyncExternalStore } from "react";

/** Shared 30-second clock so every countdown on the page ticks together. */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let now = Date.now();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
}

/** "T–29d 22h", "T–3h 12m", "T–8m" — or "closed" once the moment has passed. */
export function formatTMinus(target: number, current: number): string {
  const diff = target - current;
  if (diff <= 0) return "closed";
  const minutes = Math.floor(diff / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `T–${days}d ${String(hours).padStart(2, "0")}h`;
  if (hours > 0) return `T–${hours}h ${String(mins).padStart(2, "0")}m`;
  return `T–${Math.max(mins, 1)}m`;
}

/**
 * Live T-minus chip for a deadline. Renders nothing on the server so the
 * value never mismatches during hydration.
 */
export function Countdown({
  to,
  className = "",
  tone = "light",
  closedLabel = "Closed",
}: {
  to: string | null | undefined;
  className?: string;
  tone?: "light" | "dark" | "signal";
  closedLabel?: string;
}) {
  const current = useNow();
  if (!to || current === null) {
    return <span className={`inline-block h-6 w-20 ${className}`} aria-hidden />;
  }
  const target = new Date(to).getTime();
  const label = formatTMinus(target, current);
  const closed = label === "closed";
  const tones = {
    light: closed ? "bg-zinc-100 text-zinc-500" : "bg-ink text-signal-300",
    dark: closed ? "bg-white/10 text-white/60" : "bg-signal-300 text-ink",
    signal: closed ? "bg-zinc-100 text-zinc-500" : "bg-signal-300 text-ink",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs font-semibold tabular-nums ${tones[tone]} ${className}`}
      title={new Date(to).toLocaleString()}
    >
      {!closed ? <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> : null}
      {closed ? closedLabel : label}
    </span>
  );
}
