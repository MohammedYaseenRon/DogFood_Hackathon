import Link from "next/link";
import type { ProjectSummary } from "@/lib/api";
import { projectThumbnail } from "@/lib/galleryUtils";

export function ProjectCover({
  project,
  className = "",
  large = false,
}: {
  project: Pick<ProjectSummary, "id" | "title" | "thumbnailUrl">;
  className?: string;
  large?: boolean;
}) {
  const cover = projectThumbnail(project);
  if (project.thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={project.thumbnailUrl} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} />
    );
  }
  return (
    <div className={`flex h-full w-full items-end p-4 ${cover.bg} ${className}`}>
      <span
        className={`font-display leading-none font-semibold tracking-tight ${cover.fg} ${
          large ? "text-7xl sm:text-8xl" : "text-5xl"
        }`}
      >
        {cover.monogram}
      </span>
    </div>
  );
}

export function ProjectCard({
  project,
  showEvent = false,
}: {
  project: ProjectSummary;
  showEvent?: boolean;
}) {
  const tags = project.techTags.slice(0, 3);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white transition duration-200 hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-[0_12px_28px_-16px_rgba(21,19,43,0.35)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-line">
        <ProjectCover project={project} className="transition duration-300 group-hover:scale-[1.03]" />
        {project.trackName ? (
          <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide text-ink uppercase backdrop-blur-sm">
            {project.trackName}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h2 className="line-clamp-1 text-[15px] font-semibold text-ink group-hover:text-brand-700">
          {project.title}
        </h2>
        <p className="mt-1 line-clamp-2 flex-1 text-sm leading-relaxed text-zinc-500">
          {project.tagline || project.summary}
        </p>

        {tags.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs">
          <span className="truncate font-medium text-zinc-700">{project.teamName}</span>
          <span className="shrink-0 font-mono text-zinc-400">
            {project.memberCount} {project.memberCount === 1 ? "member" : "members"}
          </span>
        </div>
        {showEvent && project.event ? (
          <p className="mt-1 truncate font-mono text-[11px] text-zinc-400">{project.event.name}</p>
        ) : null}
      </div>
    </Link>
  );
}
