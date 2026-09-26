import { ButtonLink } from "@/components/ui/Button";

const sections = [
  {
    tag: "Your submission hub",
    title: "Submit projects in one click",
    description:
      "Participants join teams via invite links, draft projects, edit until the deadline, and submit — all before the backend hard-stops late entries.",
    cta: "Go to participant hub",
    href: "/participant",
    mockGradient: "from-amber-400 to-orange-500",
    mockLabel: "Submit",
    reverse: false,
  },
  {
    tag: "A showcase of every project",
    title: "Browse the full gallery",
    description:
      "Search, filter by track, and discover what teams built. A public gallery anyone can explore — no account required.",
    cta: "Browse gallery",
    href: "/projects",
    mockGradient: "from-blue-500 to-indigo-600",
    mockLabel: "Gallery",
    reverse: true,
  },
  {
    tag: "Fair judging, built in",
    title: "Score with backend isolation",
    description:
      "Judges review assigned projects with weighted rubrics. Peer scores are blocked at the API — not just hidden in the template.",
    cta: "Open judging",
    href: "/judging",
    mockGradient: "from-emerald-500 to-teal-600",
    mockLabel: "Judge",
    reverse: false,
  },
];

function MockScreen({
  gradient,
  label,
}: {
  gradient: string;
  label: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/60">
      <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
      </div>
      <div className={`flex h-56 items-center justify-center bg-gradient-to-br ${gradient} sm:h-64`}>
        <div className="rounded-xl bg-white/20 px-6 py-4 backdrop-blur-sm">
          <p className="font-display text-2xl font-bold text-white">{label}</p>
          <p className="mt-1 text-sm text-white/80">dogfood.localhost</p>
        </div>
      </div>
      <div className="space-y-2 p-4">
        <div className="h-3 w-3/4 rounded bg-zinc-100" />
        <div className="h-3 w-1/2 rounded bg-zinc-100" />
        <div className="mt-3 flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-zinc-100" />
          <div className="h-8 w-20 rounded-lg bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}

export function ShowcaseSections() {
  return (
    <section className="py-8">
      {sections.map((section) => (
        <div
          key={section.title}
          className="mx-auto max-w-7xl px-6 py-16 lg:py-20"
        >
          <div
            className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 ${
              section.reverse ? "lg:[direction:rtl]" : ""
            }`}
          >
            <div className={section.reverse ? "lg:[direction:ltr]" : ""}>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#3770FF]">
                {section.tag}
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold text-zinc-900 sm:text-4xl">
                {section.title}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-zinc-500">
                {section.description}
              </p>
              <ButtonLink
                href={section.href}
                className="mt-8 !bg-[#3770FF] !from-[#3770FF] !to-[#2563eb]"
              >
                {section.cta}
              </ButtonLink>
            </div>
            <div className={section.reverse ? "lg:[direction:ltr]" : ""}>
              <MockScreen
                gradient={section.mockGradient}
                label={section.mockLabel}
              />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
