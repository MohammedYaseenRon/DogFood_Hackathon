import type { ReactNode } from "react";
import { PageHeaderBand } from "@/components/ui/PageShell";

export function FormPageLayout({
  eyebrow = "Dogfood",
  title,
  mark,
  description,
  children,
  aside,
  footer,
  fullWidth = false,
}: {
  eyebrow?: string;
  title: string;
  mark?: string | false;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  /** Skip the inner card wrapper — use when the child component has its own layout. */
  fullWidth?: boolean;
}) {
  const panel = "rounded-2xl border border-line bg-white p-6 sm:p-8";

  return (
    <main className="pb-24">
      <PageHeaderBand eyebrow={eyebrow} title={title} mark={mark} description={description} maxWidth="max-w-6xl" />
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        {aside ? (
          <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
            <div className={`${fullWidth ? "" : panel} lg:col-span-8`}>{children}</div>
            <div className="lg:col-span-4">{aside}</div>
          </div>
        ) : fullWidth ? (
          children
        ) : (
          <div className={panel}>{children}</div>
        )}
        {footer ? <div className="mt-8">{footer}</div> : null}
      </div>
    </main>
  );
}
