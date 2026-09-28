import { Suspense } from "react";
import Link from "next/link";
import { GalleryFilters } from "@/components/GalleryFilters";
import { GallerySection } from "@/components/GallerySection";
import { ProjectCard } from "@/components/ProjectCard";
import { SubmitProjectCta } from "@/components/RoleGuards";
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
    <main className="min-h-screen bg-[#0b1020] pb-20">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.35),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(236,72,153,0.2),_transparent_40%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-12 lg:py-16">
          <p className="text-xs font-bold tracking-[0.22em] text-violet-300 uppercase">
            Public gallery
          </p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                {isFiltered
                  ? params.q
                    ? `Results for "${params.q}"`
                    : activeTrack?.name ?? "Projects"
                  : "Built at the hackathon"}
              </h1>
              <p className="mt-3 max-w-xl text-base text-zinc-300">
                {projects.length} submitted project
                {projects.length !== 1 ? "s" : ""}
                {event ? ` from ${event.name}` : ""} — browse, search, get inspired.
              </p>
            </div>
            <SubmitProjectCta size="md" className="!shadow-lg" />
          </div>
        </div>
      </section>

      <div className="rounded-t-[2rem] bg-[#f4f6fb] pt-2">
        <Suspense fallback={null}>
          <GalleryFilters tracks={event?.tracks ?? []} />
        </Suspense>

        <div className="mx-auto max-w-7xl px-6 py-8">
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
      </div>

      <Link
        href="/login"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-xl font-bold text-white shadow-lg shadow-violet-500/40 transition hover:scale-105"
        aria-label="Get help"
      >
        ?
      </Link>
    </main>
  );
}
