import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
  badge,
  eyebrow,
  variant = "inline",
  maxWidth = "max-w-7xl",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  badge?: ReactNode;
  eyebrow?: string;
  variant?: "inline" | "compact";
  maxWidth?: string;
}) {
  if (variant === "compact") {
    return (
      <div className="border-b border-zinc-200 bg-white">
        <div
          className={`mx-auto flex flex-col gap-4 px-6 py-8 sm:flex-row sm:items-end sm:justify-between ${maxWidth}`}
        >
          <div>
            {eyebrow ? (
              <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">
                {eyebrow}
              </p>
            ) : null}
            {badge ? <div className={eyebrow ? "mt-2" : undefined}>{badge}</div> : null}
            <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-zinc-950">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-[0.18em] text-violet-600 uppercase">
            {eyebrow}
          </p>
        ) : null}
        {badge ? <div className={eyebrow ? "mt-2" : "mb-3"}>{badge}</div> : null}
        <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-zinc-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
