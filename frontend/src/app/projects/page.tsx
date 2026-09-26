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
  const trackGroups = event
    ? groupProjectsByTrack(projects, event.tracks)
    : [];

  const activeTrack = event?.tracks.find((t) => t.id === params.track);

  return (
    <main className="min-h-screen bg-[#f8f9fa]">
      <Suspense fallback={null}>
        <GalleryFilters tracks={event?.tracks ?? []} />
      </Suspense>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Top bar when filtered */}
        {isFiltered ? (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-zinc-900">
                {params.q
                  ? `Results for "${params.q}"`
                  : activeTrack
                    ? activeTrack.name
                    : "Projects"}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {projects.length} project{projects.length !== 1 ? "s" : ""}{" "}
                found
              </p>
            </div>
            <ButtonLink href="/projects/new" size="sm">
              Submit project
            </ButtonLink>
          </div>
        ) : null}

        {projects.length === 0 ? (
          <EmptyState
            title="No projects found"
            description="Try a different search term or clear the track filter."
            action={<ButtonLink href="/projects">Clear filters</ButtonLink>}
          />
        ) : isFiltered ? (
          /* Flat grid when searching or filtering by track */
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {projects.map((project, index) => (
              <li key={project.id}>
                <ProjectCard project={project} winner={index === 0} />
              </li>
            ))}
          </ul>
        ) : (
          /* Sectioned layout like Devfolio */
          <>
            <GallerySection
              title="Staff picks"
              projects={projects}
              showWinners
            />

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

      {/* Floating help button like Devfolio */}
      <Link
        href="/login"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-2xl font-bold text-white shadow-lg transition hover:bg-teal-800 hover:shadow-xl"
        aria-label="Get help"
      >
        ?
      </Link>
    </main>
  );
}
