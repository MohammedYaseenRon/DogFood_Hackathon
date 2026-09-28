import type { ReactNode } from "react";

type PageTone = "violet" | "blue" | "emerald" | "amber" | "slate";

const toneStyles: Record<
  PageTone,
  { gradient: string; eyebrow: string; orb1: string; orb2: string }
> = {
  violet: {
    gradient: "from-violet-50 via-white to-indigo-50/80",
    eyebrow: "text-violet-600",
    orb1: "bg-violet-300/25",
    orb2: "bg-indigo-200/30",
  },
  blue: {
    gradient: "from-sky-50 via-white to-blue-50/80",
    eyebrow: "text-sky-600",
    orb1: "bg-sky-300/25",
    orb2: "bg-blue-200/30",
  },
  emerald: {
    gradient: "from-emerald-50 via-white to-teal-50/80",
    eyebrow: "text-emerald-600",
    orb1: "bg-emerald-300/25",
    orb2: "bg-teal-200/30",
  },
  amber: {
    gradient: "from-amber-50 via-white to-orange-50/80",
    eyebrow: "text-amber-600",
    orb1: "bg-amber-300/25",
    orb2: "bg-orange-200/30",
  },
  slate: {
    gradient: "from-zinc-100 via-white to-zinc-50/80",
    eyebrow: "text-zinc-600",
    orb1: "bg-zinc-300/20",
    orb2: "bg-zinc-200/30",
  },
};

export function PageShell({
  eyebrow,
  title,
  description,
  badge,
  action,
  children,
  tone = "violet",
  maxWidth = "max-w-7xl",
  headerExtra,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tone?: PageTone;
  maxWidth?: string;
  headerExtra?: ReactNode;
}) {
  const styles = toneStyles[tone];

  return (
    <main className="min-h-screen pb-20">
      <div
        className={`relative overflow-hidden border-b border-white/60 bg-gradient-to-br ${styles.gradient}`}
      >
        <div className="page-dot-grid absolute inset-0 opacity-50" />
        <div
          className={`absolute -right-16 -top-16 h-72 w-72 rounded-full ${styles.orb1} blur-3xl`}
        />
        <div
          className={`absolute -bottom-20 -left-10 h-56 w-56 rounded-full ${styles.orb2} blur-3xl`}
        />

        <div className={`relative mx-auto px-6 py-10 lg:py-12 ${maxWidth}`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              {eyebrow ? (
                <p
                  className={`text-xs font-bold tracking-[0.2em] uppercase ${styles.eyebrow}`}
                >
                  {eyebrow}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
                  {title}
                </h1>
                {badge}
              </div>
              {description ? (
                <p className="mt-3 text-base leading-relaxed text-zinc-600 sm:text-lg">
                  {description}
                </p>
              ) : null}
            </div>
            {action ? (
              <div className="flex shrink-0 flex-wrap gap-2">{action}</div>
            ) : null}
          </div>
          {headerExtra ? <div className="mt-8">{headerExtra}</div> : null}
        </div>
      </div>

      <div className={`page-surface relative mx-auto px-6 py-8 ${maxWidth}`}>
        {children}
      </div>
    </main>
  );
}

export function PageSection({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-5 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-zinc-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
