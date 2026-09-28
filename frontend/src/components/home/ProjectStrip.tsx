import Link from "next/link";
import type { ProjectSummary } from "@/lib/api";
import { projectThumbnail } from "@/lib/galleryUtils";

export function ProjectStrip({ projects }: { projects: ProjectSummary[] }) {
  const preview = projects.slice(0, 8);
  if (preview.length === 0) return null;

  return (
    <section className="border-y border-zinc-100 bg-zinc-50 py-12">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center text-sm font-medium text-zinc-400">
          A few projects from the gallery
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          {preview.map((project) => {
            const thumb = projectThumbnail(project);
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition hover:border-[#3770FF]/30 hover:shadow-md"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br ${thumb.gradient} text-sm font-bold text-white`}
                >
                  {project.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={project.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    project.title.slice(0, 1).toUpperCase()
                  )}
                </div>
                <span className="max-w-[140px] truncate text-sm font-semibold text-zinc-800 group-hover:text-[#3770FF]">
                  {project.title}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
