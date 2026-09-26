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
    default: "rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm",
    elevated:
      "rounded-2xl border border-zinc-100 bg-white p-6 shadow-xl shadow-zinc-200/50",
    dark: "rounded-2xl border border-white/10 bg-zinc-900/80 p-6 text-white backdrop-blur-sm",
    glass:
      "rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md",
  };

  return <div className={`${variants[variant]} ${className}`}>{children}</div>;
}
