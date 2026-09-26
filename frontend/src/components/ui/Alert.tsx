const tones = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={`text-sm ${title ? "mt-1 opacity-90" : ""}`}>
        {children}
      </div>
    </div>
  );
}
