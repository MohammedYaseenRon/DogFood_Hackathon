import { Suspense } from "react";
import Link from "next/link";
import { GalleryFilters } from "@/components/GalleryFilters";
import { ProjectCard } from "@/components/ProjectCard";
import { SubmitProjectCta } from "@/components/RoleGuards";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchEvents, fetchGalleryFacets, fetchProjects } from "@/lib/server-api";

const PAGE_SIZE = 60;

type ProjectsPageProps = {
  searchParams: Promise<{
    q?: string;
    track?: string;
    event?: string;
    tag?: string;
    sort?: string;
    page?: string;
  }>;
};

function pageHref(params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/projects?${query}` : "/projects";
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const sort = params.sort ?? "title";
  const [projects, facets, events] = await Promise.all([
    fetchProjects({ q: params.q, track: params.track, event: params.event, tag: params.tag, sort }),
    fetchGalleryFacets(params.event),
    fetchEvents(),
  ]);

  const activeEvent = events.find((e) => e.slug === params.event);
  const isFiltered = Boolean(params.q || params.track || params.tag);
  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.page) || 1), totalPages);
  const visible = projects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const multipleEvents = !activeEvent && events.length > 1;

  return (
    <main className="min-h-screen bg-[#0b1020] pb-20">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.35),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(236,72,153,0.2),_transparent_40%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-12 lg:py-16">
          <p className="text-xs font-bold tracking-[0.22em] text-violet-300 uppercase">Public gallery</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                {params.q ? `Results for "${params.q}"` : activeEvent ? activeEvent.name : "Submitted projects"}
              </h1>
              <p className="mt-3 max-w-xl text-base text-zinc-300">
                {projects.length} submitted project{projects.length !== 1 ? "s" : ""}
                {activeEvent ? "" : events.length > 1 ? ` across ${events.length} events` : ""}. Only
                final submissions appear here — drafts stay private to their team.
              </p>
            </div>
            <SubmitProjectCta size="md" className="!shadow-lg" event={activeEvent?.slug} />
          </div>
        </div>
      </section>

      <div className="rounded-t-[2rem] bg-[#f4f6fb] pt-2">
        <Suspense fallback={null}>
          <GalleryFilters
            key={params.q ?? ""}
            events={events.map((e) => ({ slug: e.slug, name: e.name }))}
            tracks={facets.tracks}
            tags={facets.tags}
          />
        </Suspense>

        <div className="mx-auto max-w-7xl px-6 py-8">
          {visible.length === 0 ? (
            <EmptyState
              title={isFiltered ? "No projects match" : "No submissions yet"}
              description={
                isFiltered
                  ? "Try a different search term or clear the filters."
                  : "Projects appear here once teams submit them."
              }
              action={isFiltered ? <ButtonLink href="/projects">Clear filters</ButtonLink> : undefined}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {visible.map((project) => (
                <li key={project.id}>
                  <ProjectCard project={project} showEvent={multipleEvents} />
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3 text-sm">
              {page > 1 ? (
                <Link href={pageHref(params, page - 1)} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 font-medium hover:bg-zinc-50">
                  ← Previous
                </Link>
              ) : null}
              <span className="text-zinc-500">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={pageHref(params, page + 1)} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 font-medium hover:bg-zinc-50">
                  Next →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </div>
    </main>
  );
}
