export function Stat({
  label,
  value,
  hint,
  variant = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  variant?: "default" | "dark" | "gradient";
}) {
  if (variant === "dark") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <p className="text-sm font-medium text-zinc-400">{label}</p>
        <p className="font-display mt-2 text-4xl font-bold text-white">{value}</p>
        {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
      </div>
    );
  }

  if (variant === "gradient") {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white shadow-lg shadow-violet-500/20">
        <p className="text-sm font-medium text-violet-200">{label}</p>
        <p className="font-display mt-2 text-4xl font-bold">{value}</p>
        {hint ? <p className="mt-1 text-xs text-violet-200/80">{hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition hover:shadow-md">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="font-display mt-2 text-3xl font-bold text-zinc-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}
