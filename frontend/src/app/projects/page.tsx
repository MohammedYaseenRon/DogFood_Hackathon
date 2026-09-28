import { Suspense } from "react";
import Link from "next/link";
import { GalleryFilters } from "@/components/GalleryFilters";
import { GallerySection } from "@/components/GallerySection";
import { ProjectCard } from "@/components/ProjectCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { fetchEvent, fetchProjects } from "@/lib/api";
import { groupProjectsByTrack } from "@/lib/galleryUtils";

type ProjectsPageProps = {
  searchParams: Promise<{ q?: string; track?: string }>;
};

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const [projects, event] = await Promise.all([
    fetchProjects({ q: params.q, track: params.track }),
    fetchEvent(),
  ]);

  const isFiltered = Boolean(params.q || params.track);
  const trackGroups = event ? groupProjectsByTrack(projects, event.tracks) : [];
  const activeTrack = event?.tracks.find((t) => t.id === params.track);

  return (
    <main className="min-h-screen pb-20">
      <div className="relative overflow-hidden border-b border-white/60 bg-gradient-to-br from-indigo-50 via-white to-violet-50/80">
        <div className="page-dot-grid absolute inset-0 opacity-50" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-6 py-10 lg:py-12">
          <p className="text-xs font-bold tracking-[0.2em] text-indigo-600 uppercase">
            Gallery
          </p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
                {isFiltered
                  ? params.q
                    ? `Results for "${params.q}"`
                    : activeTrack?.name ?? "Projects"
                  : "Project showcase"}
              </h1>
              <p className="mt-2 text-base text-zinc-600">
                {projects.length} submitted project{projects.length !== 1 ? "s" : ""}
                {event ? ` from ${event.name}` : ""}
              </p>
            </div>
            <ButtonLink href="/projects/new" size="sm">
              Submit project
            </ButtonLink>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <GalleryFilters tracks={event?.tracks ?? []} />
      </Suspense>

      <div className="page-surface mx-auto max-w-7xl px-6 py-8">
        {projects.length === 0 ? (
          <EmptyState
            title="No projects found"
            description="Try a different search term or clear the track filter."
            action={<ButtonLink href="/projects">Clear filters</ButtonLink>}
          />
        ) : isFiltered ? (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {projects.map((project, index) => (
              <li key={project.id}>
                <ProjectCard project={project} winner={index === 0} />
              </li>
            ))}
          </ul>
        ) : (
          <>
            <GallerySection title="Staff picks" projects={projects} showWinners />
            {trackGroups.map((group) => (
              <GallerySection
                key={group.trackId || group.trackName}
                title={`Built at ${event?.name ?? "hackathon"} — ${group.trackName}`}
                projects={group.projects}
                trackId={group.trackId}
                showWinners
              />
            ))}
          </>
        )}
      </div>

      <Link
        href="/login"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-violet-500/30 transition hover:scale-105"
        aria-label="Get help"
      >
        ?
      </Link>
    </main>
  );
}
