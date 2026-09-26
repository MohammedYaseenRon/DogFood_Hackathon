import { Suspense } from "react";
import { GalleryFilters } from "@/components/GalleryFilters";
import { ProjectCard } from "@/components/ProjectCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchEvent, fetchProjects } from "@/lib/api";

type ProjectsPageProps = {
  searchParams: Promise<{ q?: string; track?: string }>;
};

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const params = await searchParams;
  const [projects, event] = await Promise.all([
    fetchProjects({ q: params.q, track: params.track }),
    fetchEvent(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        title="Project gallery"
        description={
          event
            ? `${event.name} · ${projects.length} projects`
            : "Browse all hackathon submissions"
        }
        action={<ButtonLink href="/projects/new">Submit project</ButtonLink>}
      />

      <Suspense fallback={null}>
        <GalleryFilters tracks={event?.tracks ?? []} />
      </Suspense>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects found"
          description="Try a different search term or clear the track filter."
          action={<ButtonLink href="/projects">Clear filters</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
