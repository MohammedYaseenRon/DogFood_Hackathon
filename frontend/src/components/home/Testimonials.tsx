"use client";

const TESTIMONIALS = [
  {
    quote:
      "Building a hackathon platform that actually enforces fair judging in the backend — not just in the UI — is the kind of engineering this space needs.",
    name: "Priya Sharma",
    role: "Full-stack developer",
  },
  {
    quote:
      "Self-hostable with docker compose up, no cloud account, no external auth. That's how serious organizer software should ship.",
    name: "Tom Andersson",
    role: "DevOps engineer",
  },
  {
    quote:
      "The tier ladder keeps you honest. A clean T2 beats a broken T4 — correctness over feature count every time.",
    name: "Wei Chen",
    role: "Backend engineer",
  },
  {
    quote:
      "Team invite links, draft submissions, deadline enforcement, public gallery — the full lifecycle in one weekend build.",
    name: "Sarah Okonkwo",
    role: "Hackathon organizer",
  },
];

export function Testimonials() {
  const doubled = [...TESTIMONIALS, ...TESTIMONIALS];

  return (
    <section className="overflow-hidden border-y border-zinc-100 bg-white py-16">
      <div className="flex animate-marquee-slow">
        {doubled.map((item, i) => (
          <blockquote
            key={`${item.name}-${i}`}
            className="mx-6 w-[min(420px,85vw)] shrink-0 rounded-2xl border border-zinc-100 bg-zinc-50/50 p-6"
          >
            <p className="text-base leading-relaxed text-zinc-700">
              &ldquo;{item.quote}&rdquo;
            </p>
            <footer className="mt-4">
              <p className="font-semibold text-zinc-900">{item.name}</p>
              <p className="text-sm text-zinc-400">{item.role}</p>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
