import type { ProjectSummary } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Card className="flex h-full flex-col transition hover:border-indigo-200 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{project.title}</h2>
        <Badge tone="brand">{project.trackName}</Badge>
      </div>
      <p className="flex-1 text-sm leading-relaxed text-slate-600">
        {project.summary}
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>{project.teamName}</span>
        <a
          href={project.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-indigo-600 hover:text-indigo-800"
        >
          Repository →
        </a>
      </div>
    </Card>
  );
}
