import type { ReactNode } from "react";
import { Eyebrow, MarkedTitle } from "@/components/ui/MarkedTitle";

/**
 * Standard page frame: a graph-paper header band (eyebrow, highlighted title,
 * description, actions) above the page content.
 *
 * `tone` is kept for API compatibility; the system uses one palette.
 */
export function PageShell({
  eyebrow,
  title,
  mark,
  description,
  badge,
  action,
  children,
  maxWidth = "max-w-7xl",
  headerExtra,
}: {
  eyebrow?: string;
  title: string;
  /** Phrase in the title to highlight; defaults to the last word, `false` disables. */
  mark?: string | false;
  description?: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tone?: string;
  maxWidth?: string;
  headerExtra?: ReactNode;
}) {
  return (
    <main className="pb-24">
      <PageHeaderBand
        eyebrow={eyebrow}
        title={title}
        mark={mark}
        description={description}
        badge={badge}
        action={action}
        maxWidth={maxWidth}
        extra={headerExtra}
      />
      <div className={`relative mx-auto px-5 sm:px-6 ${maxWidth}`}>{children}</div>
    </main>
  );
}

export function PageHeaderBand({
  eyebrow,
  title,
  mark,
  description,
  badge,
  action,
  maxWidth = "max-w-7xl",
  extra,
}: {
  eyebrow?: string;
  title: string;
  mark?: string | false;
  description?: string;
  badge?: ReactNode;
  action?: ReactNode;
  maxWidth?: string;
  extra?: ReactNode;
}) {
  return (
    <header className="relative">
      <div aria-hidden className="graph-paper absolute inset-0" />
      <div className={`relative mx-auto px-5 pb-10 pt-12 sm:px-6 lg:pt-16 ${maxWidth}`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            <h1 className="font-display mt-4 text-[1.9rem] leading-[1.12] font-semibold text-ink sm:text-[2.6rem]">
              <MarkedTitle text={title} mark={mark} />
            </h1>
            {badge ? <div className="mt-4 flex flex-wrap items-center gap-2">{badge}</div> : null}
            {description ? (
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-[17px]">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
        </div>
        {extra ? <div className="mt-8">{extra}</div> : null}
      </div>
    </header>
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
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
