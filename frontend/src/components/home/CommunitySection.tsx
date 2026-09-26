import { ButtonLink } from "@/components/ui/Button";

const organizerFeatures = [
  "Track and accept registrations",
  "Assign judges with batch algorithms",
  "Monitor scoring progress live",
  "Export CSV results instantly",
];

export function CommunitySection() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        {/* Community */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-zinc-900 sm:text-4xl">
            We speak, we listen, we discuss, we grow.
          </h2>
          <p className="mt-4 text-lg text-zinc-500">
            Share ideas, feedback, and connect with builders over the love of
            hackathons. Join the Hackathon Raptors community on Discord.
          </p>
          <ButtonLink
            href="https://dogfoodhack.com"
            variant="secondary"
            className="mt-8"
          >
            Visit dogfoodhack.com
          </ButtonLink>
        </div>

        {/* Organizer pitch */}
        <div className="mt-24 grid items-center gap-12 rounded-3xl border border-zinc-200 bg-zinc-50 p-8 lg:grid-cols-2 lg:p-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[#3770FF]">
              Dogfood for organizers
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold text-zinc-900">
              No more spreadsheets. Run the whole event here.
            </h2>
            <p className="mt-4 text-zinc-500">
              Focus on your people — team formation, submissions, judging,
              normalization, and results export all in one self-hostable
              platform.
            </p>
            <ButtonLink
              href="/organizer/dashboard"
              className="mt-8 !bg-[#3770FF] !from-[#3770FF] !to-[#2563eb]"
            >
              Organizer dashboard
            </ButtonLink>
          </div>

          <ul className="space-y-4">
            {organizerFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-4 text-sm font-medium text-zinc-700 shadow-sm"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3770FF]/10 text-[#3770FF]">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
