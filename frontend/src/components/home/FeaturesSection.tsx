import { ButtonLink } from "@/components/ui/Button";

const features = [
  {
    title: "Team formation",
    description: "Invite links let teammates join in one click. No messy spreadsheets.",
    icon: "🔗",
  },
  {
    title: "Draft & submit",
    description: "Save drafts, edit freely, and submit before the hard deadline.",
    icon: "📝",
  },
  {
    title: "Fair judging",
    description: "Weighted rubrics with backend-enforced score isolation between judges.",
    icon: "🎯",
  },
  {
    title: "Score normalization",
    description: "Cross-judge normalization so harsh and generous scorers are balanced.",
    icon: "📐",
  },
  {
    title: "CSV export",
    description: "Organizers download complete results for the entire event.",
    icon: "📥",
  },
  {
    title: "Self-hostable",
    description: "Runs with docker compose up. No cloud account required.",
    icon: "🐳",
  },
];

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-600">
            Platform features
          </p>
          <h2 className="font-display mt-2 text-3xl font-bold text-zinc-900 sm:text-4xl">
            Everything an organizer needs
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-zinc-500">
            Registration, team formation, submissions, judge assignment, scoring,
            normalization, and results — one complex pipeline, one platform.
          </p>
          <ButtonLink href="/login" className="mt-8">
            Get started
          </ButtonLink>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-zinc-200/80 bg-white p-5 transition hover:border-violet-200 hover:shadow-md"
            >
              <span className="text-2xl">{feature.icon}</span>
              <h3 className="mt-3 font-semibold text-zinc-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
