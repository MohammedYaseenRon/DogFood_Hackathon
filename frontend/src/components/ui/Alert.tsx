const tones = {
  info: { box: "border-brand-200 bg-brand-50/70 text-brand-950", bar: "bg-brand-500" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-950", bar: "bg-amber-500" },
  error: { box: "border-red-200 bg-red-50 text-red-950", bar: "bg-red-500" },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-950", bar: "bg-emerald-500" },
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
  const style = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`relative overflow-hidden rounded-xl border py-3 pl-5 pr-4 ${style.box}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
      {title ? <p className="text-sm font-semibold">{title}</p> : null}
      <div className={`text-sm leading-relaxed ${title ? "mt-0.5 opacity-85" : ""}`}>{children}</div>
    </div>
  );
}
