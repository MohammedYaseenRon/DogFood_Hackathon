import type { JudgeStatus } from "@/lib/api";

/** Mono uppercase label used across the judging console. */
export function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase ${className}`}>{children}</p>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-line bg-white ${className}`}>
      <header className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-zinc-500">{description}</p> : null}
        </div>
        {action}
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

const STATUS: Record<JudgeStatus, { label: string; cls: string }> = {
  unassigned: { label: "Unassigned", cls: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
  not_started: { label: "Not started", cls: "bg-red-50 text-red-700 ring-red-200" },
  in_progress: { label: "In progress", cls: "bg-brand-50 text-brand-700 ring-brand-200" },
  done: { label: "Done", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

export function StatusChip({ status }: { status: JudgeStatus }) {
  const style = STATUS[status];
  return (
    <span
      className={`inline-flex rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset ${style.cls}`}
    >
      {style.label}
    </span>
  );
}

export function statusLabel(status: JudgeStatus) {
  return STATUS[status].label;
}

export function TrackPicker({
  tracks,
  value,
  onChange,
  idPrefix,
}: {
  tracks: Array<{ id: string; name: string }>;
  value: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
}) {
  return (
    <fieldset>
      <legend className="field-label">
        Tracks <span className="font-normal text-zinc-400">(none selected = every track)</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {tracks.map((track) => {
          const checked = value.includes(track.id);
          return (
            <label
              key={track.id}
              htmlFor={`${idPrefix}-${track.id}`}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 ${
                checked ? "border-ink bg-ink text-white" : "border-line bg-white text-zinc-600 hover:border-zinc-400"
              }`}
            >
              <input
                id={`${idPrefix}-${track.id}`}
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() =>
                  onChange(checked ? value.filter((id) => id !== track.id) : [...value, track.id])
                }
              />
              {track.name}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-ink" />
    </div>
  );
}
