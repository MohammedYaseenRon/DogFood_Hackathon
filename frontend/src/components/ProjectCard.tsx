import Link from "next/link";
import type { ProjectSummary } from "@/lib/api";
import { projectThumbnail } from "@/lib/galleryUtils";

export function ProjectCard({
  project,
  showEvent = false,
}: {
  project: ProjectSummary;
  showEvent?: boolean;
}) {
  const thumb = projectThumbnail(project);
  const tags = project.techTags.slice(0, 3);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200/90 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-md"
    >
      <div className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${thumb.gradient}`}>
        {project.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <span className="font-display text-2xl font-bold text-white/95 drop-shadow">
              {project.title}
            </span>
          </div>
        )}
        {project.trackName ? (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            {project.trackName}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h2 className="line-clamp-1 text-[15px] font-bold leading-snug text-zinc-900 group-hover:text-blue-600">
          {project.title}
        </h2>
        <p className="mt-1.5 line-clamp-2 flex-1 text-[13px] leading-relaxed text-zinc-500">
          {project.tagline || project.summary}
        </p>

        {tags.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          <span className="truncate font-medium text-zinc-700">{project.teamName}</span>
          <span className="shrink-0">
            {project.memberCount} member{project.memberCount === 1 ? "" : "s"}
          </span>
        </div>
        {showEvent && project.event ? (
          <p className="mt-1 truncate text-[11px] text-zinc-400">{project.event.name}</p>
        ) : null}
      </div>
    </Link>
  );
}
