import type { ProjectSummary } from "@/lib/api";
import {
  projectStats,
  projectThumbnail,
  teamAvatars,
} from "@/lib/galleryUtils";

export function ProjectCard({
  project,
  winner = false,
}: {
  project: ProjectSummary;
  winner?: boolean;
}) {
  const thumb = projectThumbnail(project);
  const stats = projectStats(project);
  const avatars = teamAvatars(project.teamName);

  return (
    <a
      href={project.repoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200/90 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-md"
    >
      {/* Thumbnail */}
      <div
        className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${thumb.gradient}`}
      >
        {winner ? (
          <div className="absolute left-0 top-0 z-10 overflow-hidden">
            <div className="relative -ml-8 mt-3 w-32 rotate-[-45deg] bg-amber-400 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-zinc-900 shadow-sm">
              Winner
            </div>
          </div>
        ) : null}

        <div className="flex h-full items-center justify-center">
          <span className="text-5xl opacity-90 drop-shadow-lg transition group-hover:scale-110">
            {thumb.icon}
          </span>
        </div>

        <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/5" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h2 className="line-clamp-1 text-[15px] font-bold leading-snug text-zinc-900 group-hover:text-blue-600">
          {project.title}
        </h2>
        <p className="mt-1.5 line-clamp-2 flex-1 text-[13px] italic leading-relaxed text-zinc-500">
          {project.summary}
        </p>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {avatars.map((avatar, i) => (
                <div
                  key={i}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white ${avatar.color}`}
                >
                  {avatar.initial}
                </div>
              ))}
            </div>
            {avatars.length > 1 ? (
              <span className="ml-1.5 text-xs text-zinc-400">
                +{avatars.length - 1}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3 text-zinc-400">
            <span className="flex items-center gap-1 text-xs">
              <HeartIcon />
              {stats.likes}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <CommentIcon />
              {stats.comments}
            </span>
          </div>
        </div>
      </div>

    </a>
  );
}

function HeartIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
