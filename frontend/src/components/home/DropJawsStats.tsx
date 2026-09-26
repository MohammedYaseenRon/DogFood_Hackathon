import type { PublicStats } from "@/lib/api";

export function DropJawsStats({ stats }: { stats: PublicStats | null }) {
  if (!stats) return null;

  const items = [
    { value: `${stats.projectCount}+`, label: "projects" },
    { value: `${stats.judgeCount}+`, label: "judges" },
    { value: `${stats.trackCount}`, label: "tracks" },
    { value: "1", label: "live event" },
  ];

  return (
    <section className="border-y border-zinc-100 bg-white py-20">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <h2 className="font-display text-3xl font-bold text-zinc-900 sm:text-4xl">
          We drop jaws!
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-zinc-500">
          A self-hostable submission and judging platform built for Dogfood 2026
          — open source, offline-ready, production-grade.
        </p>

        <ul className="mt-14 grid grid-cols-2 gap-8 sm:grid-cols-4">
          {items.map((item) => (
            <li key={item.label}>
              <p className="font-display text-4xl font-bold text-zinc-900 sm:text-5xl">
                {item.value}
              </p>
              <p className="mt-2 text-sm font-medium uppercase tracking-wider text-zinc-400">
                {item.label}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
