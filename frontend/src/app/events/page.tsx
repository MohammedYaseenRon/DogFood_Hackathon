import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchEvents } from "@/lib/server-api";

export default async function EventsPage() {
  const events = await fetchEvents();

  return (
    <main className="min-h-screen bg-[#0b1020]">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(56,189,248,0.3),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(167,139,250,0.35),_transparent_45%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-14 lg:py-20">
          <p className="text-xs font-bold tracking-[0.22em] text-sky-300 uppercase">
            Discover
          </p>
          <h1 className="font-display mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Hackathons that ship
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-zinc-300">
            Browse live events, register as a participant, form a team, and submit
            before the clock runs out.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register?redirect=/events"
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-100"
            >
              Create account
            </Link>
            <Link
              href="/projects"
              className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Browse projects
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-t-[2.5rem] bg-[#f4f6fb] px-6 py-12">
        <div className="mx-auto max-w-7xl">
          {events.length === 0 ? (
            <EmptyState
              title="No published events"
              description="Check back soon or sign in as an organizer to create one."
            />
          ) : (
            <ul className="grid gap-6 lg:grid-cols-2">
              {events.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
