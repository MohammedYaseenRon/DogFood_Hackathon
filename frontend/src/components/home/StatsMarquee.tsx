const items = [
  { value: "40+", label: "Projects submitted" },
  { value: "30+", label: "Expert judges" },
  { value: "8", label: "Competition tracks" },
  { value: "100%", label: "Self-hostable" },
  { value: "T1+T2", label: "Verified tiers" },
  { value: "Offline", label: "No cloud required" },
];

export function StatsMarquee() {
  const doubled = [...items, ...items];

  return (
    <section className="overflow-hidden border-y border-zinc-200 bg-white py-6">
      <div className="flex animate-marquee whitespace-nowrap">
        {doubled.map((item, i) => (
          <div
            key={`${item.label}-${i}`}
            className="mx-8 flex items-center gap-3"
          >
            <span className="font-display text-2xl font-bold text-violet-600">
              {item.value}
            </span>
            <span className="text-sm font-medium text-zinc-500">
              {item.label}
            </span>
            <span className="text-zinc-300">·</span>
          </div>
        ))}
      </div>
    </section>
  );
}
