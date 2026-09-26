import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
  badge,
  variant = "default",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  badge?: ReactNode;
  variant?: "default" | "hero";
}) {
  if (variant === "hero") {
    return (
      <div className="mx-auto max-w-7xl px-6 pt-10">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-600 px-8 py-12 text-white shadow-2xl shadow-violet-500/20">
          <div className="absolute inset-0 grid-overlay opacity-30" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {badge ? <div className="mb-3">{badge}</div> : null}
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-3 max-w-2xl text-lg text-violet-100">
                  {description}
                </p>
              ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {badge ? <div className="mb-3">{badge}</div> : null}
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
