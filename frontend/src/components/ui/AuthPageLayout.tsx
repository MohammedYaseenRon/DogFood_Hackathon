import type { ReactNode } from "react";

export function AuthPageLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="min-h-[calc(100vh-140px)] bg-[#f8f9fb]">
      <div className="mx-auto flex max-w-md flex-col px-6 py-12 sm:py-16">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase">
            Dogfood
          </p>
          <h1 className="font-display mt-3 text-2xl font-bold text-zinc-900 sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              {description}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>

        {footer ? <div className="mt-6 text-center">{footer}</div> : null}
      </div>
    </main>
  );
}
