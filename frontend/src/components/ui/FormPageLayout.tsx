import type { ReactNode } from "react";

export function FormPageLayout({
  eyebrow = "Dogfood",
  title,
  description,
  children,
  aside,
  footer,
  fullWidth = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  /** Skip inner card wrapper — use when child component has its own layout. */
  fullWidth?: boolean;
}) {
  const mainContent = fullWidth ? (
    <div className="relative z-10">{children}</div>
  ) : (
    <div className="relative z-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-7">
      {children}
    </div>
  );

  return (
    <main className="min-h-[calc(100vh-140px)] bg-[#f4f5f7]">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">
            {eyebrow}
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-base leading-relaxed text-zinc-500">
              {description}
            </p>
          ) : null}
        </div>

        {aside ? (
          <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
            {mainContent}
            <div className="relative z-10 lg:col-span-5">{aside}</div>
          </div>
        ) : fullWidth ? (
          mainContent
        ) : (
          <div className="relative z-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            {children}
          </div>
        )}

        {footer ? <div className="mt-8">{footer}</div> : null}
      </div>
    </main>
  );
}
