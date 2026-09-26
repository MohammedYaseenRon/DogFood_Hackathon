import { LoginPanel } from "@/components/LoginPanel";
import { ButtonLink } from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <main className="min-h-[calc(100vh-200px)]">
      <div className="mx-auto grid max-w-6xl gap-0 lg:grid-cols-2 lg:gap-8 lg:px-6 lg:py-10">
        {/* Left panel — branding */}
        <div className="hero-mesh relative hidden overflow-hidden rounded-3xl lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div className="grid-overlay absolute inset-0" />
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-wider text-violet-300">
              Dogfood 2026
            </p>
            <h1 className="font-display mt-4 text-4xl font-bold leading-tight text-white">
              Sign in to your role
            </h1>
            <p className="mt-4 text-lg text-zinc-400">
              Pick a demo session to explore the platform as an organizer,
              judge, or participant.
            </p>
          </div>

          <div className="relative space-y-4">
            {[
              { role: "Organizer", desc: "Manage event & export results", color: "from-violet-500 to-indigo-600" },
              { role: "Judge", desc: "Score assigned projects", color: "from-emerald-500 to-teal-600" },
              { role: "Participant", desc: "Submit projects & join teams", color: "from-amber-500 to-orange-600" },
            ].map((item) => (
              <div
                key={item.role}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm"
              >
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${item.color}`} />
                <div>
                  <p className="font-semibold text-white">{item.role}</p>
                  <p className="text-sm text-zinc-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — login form */}
        <div className="px-6 py-10 lg:px-8">
          <div className="lg:hidden">
            <h1 className="font-display text-3xl font-bold text-zinc-900">
              Sign in
            </h1>
            <p className="mt-2 text-zinc-500">
              Pick a demo role to explore the portal.
            </p>
          </div>

          <div className="mt-8 lg:mt-0">
            <LoginPanel />
          </div>

          <p className="mt-8 text-center text-sm text-zinc-400">
            Just browsing?{" "}
            <ButtonLink href="/projects" variant="ghost" className="inline px-1">
              View the gallery
            </ButtonLink>
          </p>
        </div>
      </div>
    </main>
  );
}
