import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "white" | "signal";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-brand-700 shadow-[0_1px_0_rgba(0,0,0,0.25)]",
  secondary: "bg-white text-ink border border-line hover:border-zinc-400 hover:bg-zinc-50",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-ink",
  danger: "bg-red-600 text-white hover:bg-red-700",
  outline: "border border-white/30 text-white hover:bg-white/10",
  white: "bg-white text-ink hover:bg-signal-100",
  signal: "bg-signal-300 text-ink hover:bg-signal-400 shadow-[0_1px_0_rgba(0,0,0,0.2)]",
};

const sizes = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
};

const base =
  "inline-flex items-center justify-center rounded-lg font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </Link>
  );
}
