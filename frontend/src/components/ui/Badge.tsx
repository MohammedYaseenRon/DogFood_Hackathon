const tones: Record<string, string> = {
  default: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  cyan: "bg-signal-100 text-signal-600 ring-signal-200",
  ink: "bg-ink text-white ring-ink",
};

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide uppercase ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
