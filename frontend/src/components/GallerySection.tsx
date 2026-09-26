import Link from "next/link";
import { ProjectCard } from "@/components/ProjectCard";
import type { ProjectSummary } from "@/lib/api";

const PREVIEW_COUNT = 4;

export function GallerySection({
  title,
  projects,
  trackId,
  showWinners = false,
}: {
  title: string;
  projects: ProjectSummary[];
  trackId?: string;
  showWinners?: boolean;
}) {
  const preview = projects.slice(0, PREVIEW_COUNT);
  const hasMore = projects.length > PREVIEW_COUNT;

  return (
    <section className="mb-12">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-700">
          {title}
        </h2>
        {hasMore && trackId ? (
          <Link
            href={`/projects?track=${trackId}`}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-blue-700"
          >
            View all
          </Link>
        ) : null}
      </div>

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {preview.map((project, index) => (
          <li key={project.id}>
            <ProjectCard
              project={project}
              winner={showWinners && index === 0}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
