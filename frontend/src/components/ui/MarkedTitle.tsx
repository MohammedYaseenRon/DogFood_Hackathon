/**
 * Page title with the highlighter swipe on one word — the site's signature.
 * `mark` picks the phrase to highlight; by default it's the last word.
 */
export function MarkedTitle({ text, mark }: { text: string; mark?: string | false }) {
  if (mark === false || !text) return <>{text}</>;

  const target = mark ?? text.trim().split(/\s+/).pop() ?? "";
  const index = target ? text.lastIndexOf(target) : -1;
  if (index < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <span className="hl">{target}</span>
      {text.slice(index + target.length)}
    </>
  );
}

/** Mono eyebrow above page titles: "participant / hub". */
export function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p
      className={`flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${
        dark ? "text-white/60" : "text-zinc-500"
      }`}
    >
      <span aria-hidden className={`h-2 w-2 rounded-[2px] ${dark ? "bg-signal-300" : "bg-ink"}`} />
      {children}
    </p>
  );
}
