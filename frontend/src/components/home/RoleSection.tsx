import { ButtonLink } from "@/components/ui/Button";

const roles = [
  {
    icon: "👁",
    title: "Visitor",
    subtitle: "Browse the gallery",
    description:
      "Explore all submitted projects. Search, filter by track, and discover what teams built — no account needed.",
    href: "/projects",
    cta: "Browse gallery",
    gradient: "from-zinc-600 to-zinc-800",
    accent: "bg-zinc-100 text-zinc-700",
  },
  {
    icon: "🚀",
    title: "Participant",
    subtitle: "Submit your project",
    description:
      "Sign in, join a team via invite link, draft your project, and submit before the deadline.",
    href: "/participant",
    cta: "Participant hub",
    gradient: "from-amber-500 to-orange-600",
    accent: "bg-amber-100 text-amber-700",
  },
  {
    icon: "⚖️",
    title: "Judge",
    subtitle: "Score submissions",
    description:
      "Review assigned projects with a weighted rubric. Backend-enforced isolation — no peeking at peer scores.",
    href: "/judging",
    cta: "Open judging",
    gradient: "from-emerald-500 to-teal-600",
    accent: "bg-emerald-100 text-emerald-700",
  },
  {
    icon: "📊",
    title: "Organizer",
    subtitle: "Run the event",
    description:
      "Monitor judging progress, track completion rates, and export CSV results for the entire hackathon.",
    href: "/organizer/dashboard",
    cta: "Organizer dashboard",
    gradient: "from-violet-600 to-indigo-600",
    accent: "bg-violet-100 text-violet-700",
  },
];

export function RoleSection() {
  return (
    <section className="bg-zinc-50 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#3770FF]">
            Built for everyone
          </p>
          <h2 className="font-display mt-2 text-3xl font-bold text-zinc-900 sm:text-4xl">
            One platform, every role
          </h2>
          <p className="mt-4 text-lg text-zinc-500">
            From browsing projects to exporting final scores — each role gets a
            dedicated experience.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {roles.map((role) => (
            <div
              key={role.title}
              className="glow-card group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-8 transition hover:shadow-xl"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${role.gradient} text-2xl shadow-lg`}
                >
                  {role.icon}
                </div>
                <div className="flex-1">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${role.accent}`}
                  >
                    {role.subtitle}
                  </span>
                  <h3 className="font-display mt-2 text-xl font-bold text-zinc-900">
                    {role.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    {role.description}
                  </p>
                  <ButtonLink
                    href={role.href}
                    variant="ghost"
                    className="mt-4 -ml-2 text-[#3770FF] hover:text-blue-700"
                  >
                    {role.cta} →
                  </ButtonLink>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
