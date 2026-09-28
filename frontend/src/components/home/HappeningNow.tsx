import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import type { EventInfo, PublicStats } from "@/lib/api";

const CARD_GRADIENTS = [
  "from-violet-500 to-indigo-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-600",
];

export function HappeningNow({
  stats,
  event,
}: {
  stats: PublicStats | null;
  event: EventInfo | null;
}) {
  if (!stats) return null;

  const closeDate = stats.submissionsClose
    ? new Date(stats.submissionsClose).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const cards = [
    {
      title: stats.eventName,
      date: closeDate ? `Closes ${closeDate}` : "Online · 72 hours",
      location: "Online · Worldwide",
      href: stats.eventSlug ? `/events/${stats.eventSlug}` : "/events",
      cta: "View event",
      gradient: CARD_GRADIENTS[0],
    },
    ...(event?.tracks.slice(0, 2).map((track, i) => ({
      title: track.name,
      date: "Active track",
      location: stats.eventName,
      href: `/projects?event=${event.slug}&track=${track.id}`,
      cta: "View projects",
      gradient: CARD_GRADIENTS[(i + 1) % CARD_GRADIENTS.length],
    })) ?? []),
  ];

  // Pad to 3 cards if needed
  while (cards.length < 3) {
    cards.push({
      title: "Submit your project",
      date: stats.submissionsOpen ? "Submissions open" : "Submissions closed",
      location: "Join a team & submit",
      href: "/participant",
      cta: "Submit now",
      gradient: CARD_GRADIENTS[cards.length % CARD_GRADIENTS.length],
    });
  }

  return (
    <section className="bg-[#fafafa] py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10 flex items-end justify-between">
          <h2 className="font-display text-2xl font-bold text-zinc-900 sm:text-3xl">
            Happening now
          </h2>
          <Link
            href={stats.eventSlug ? `/events/${stats.eventSlug}` : "/events"}
            className="text-sm font-semibold text-[#3770FF] hover:text-blue-700"
          >
            See all →
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.slice(0, 3).map((card) => (
            <article
              key={card.title + card.href}
              className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-lg"
            >
              <div
                className={`flex h-36 items-center justify-center bg-gradient-to-br ${card.gradient}`}
              >
                <span className="font-display text-4xl font-bold text-white/90">
                  {card.title.charAt(0)}
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-display text-lg font-bold text-zinc-900 group-hover:text-[#3770FF]">
                  {card.title}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">{card.date}</p>
                <p className="text-sm text-zinc-400">{card.location}</p>
                <ButtonLink
                  href={card.href}
                  size="sm"
                  className="mt-4 !bg-[#3770FF] !from-[#3770FF] !to-[#2563eb]"
                >
                  {card.cta}
                </ButtonLink>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
