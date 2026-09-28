import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "dark" | "glass";
}) {
  const variants = {
    default: "rounded-2xl border border-line bg-white p-6",
    elevated:
      "rounded-2xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(21,19,43,0.04),0_8px_24px_-12px_rgba(21,19,43,0.12)]",
    dark: "rounded-2xl bg-ink p-6 text-white",
    glass: "rounded-2xl border border-white/15 bg-white/5 p-6 text-white",
  };

  return <div className={`${variants[variant]} ${className}`}>{children}</div>;
}
