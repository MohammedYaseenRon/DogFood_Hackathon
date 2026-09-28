import type { ReactNode } from "react";
import { Eyebrow, MarkedTitle } from "@/components/ui/MarkedTitle";

/**
 * Sign-in / registration frame: the form on a white sheet, the context panel
 * beside it on the ink surface.
 */
export function AuthPageLayout({
  title,
  description,
  children,
  footer,
  aside,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <main className="relative pb-24">
      <div aria-hidden className="graph-paper absolute inset-x-0 top-0 h-80" />
      <div className="relative mx-auto max-w-6xl px-5 pt-12 sm:px-6 lg:pt-16">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          <section className="rounded-2xl border border-line bg-white p-6 sm:p-10 lg:col-span-7">
            <Eyebrow>Account</Eyebrow>
            <h1 className="font-display mt-4 text-[1.9rem] leading-tight font-semibold text-ink sm:text-4xl">
              <MarkedTitle text={title} />
            </h1>
            {description ? (
              <p className="mt-3 max-w-md text-base leading-relaxed text-zinc-600">{description}</p>
            ) : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-8">{footer}</div> : null}
          </section>
          {aside ? <aside className="lg:col-span-5">{aside}</aside> : null}
        </div>
      </div>
    </main>
  );
}
