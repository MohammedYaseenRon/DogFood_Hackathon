import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/ui/PageShell";
import { fetchProjectDetail } from "@/lib/api";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const project = await fetchProjectDetail(id);

  if (!project) {
    notFound();
  }

  const links = [
    { href: project.liveUrl, label: "Live demo" },
    { href: project.repoUrl, label: "Repository" },
    { href: project.videoUrl ?? project.demoUrl, label: "Watch demo" },
  ].filter((link) => Boolean(link.href));

  return (
    <PageShell
      tone="violet"
      eyebrow={project.trackName}
      title={project.title}
      description={project.tagline || project.summary}
      badge={<Badge tone="success">Submitted</Badge>}
      action={
        <ButtonLink href="/projects" variant="secondary" size="sm">
          Back to gallery
        </ButtonLink>
      }
    >
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card variant="elevated" className="overflow-hidden p-0">
            <div className="aspect-[16/9] bg-gradient-to-br from-violet-500 to-indigo-600">
              {project.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={project.thumbnailUrl}
                  alt={project.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-6xl text-white/90">
                  🚀
                </div>
              )}
            </div>
            <div className="p-6">
              <h2 className="font-display text-xl font-bold text-zinc-900">
                About this project
              </h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600">
                {project.summary}
              </p>
            </div>
          </Card>

          {(project.techTags ?? []).length > 0 ? (
            <Card>
              <h2 className="font-display text-lg font-bold text-zinc-900">
                Technologies
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {(project.techTags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {links.length > 0 ? (
            <Card variant="elevated">
              <h2 className="font-display text-lg font-bold text-zinc-900">Links</h2>
              <div className="mt-4 flex flex-col gap-3">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-violet-700 hover:to-indigo-700"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <h2 className="font-display text-lg font-bold text-zinc-900">Team</h2>
            <p className="mt-2 text-sm font-semibold text-zinc-700">{project.teamName}</p>
            <ul className="mt-4 space-y-3">
              {(project.members ?? []).map((member) => (
                <li
                  key={member.email}
                  className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{member.name}</p>
                    <p className="text-xs text-zinc-500">{member.email}</p>
                  </div>
                  <Badge tone="default">{member.role}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-zinc-400">Track</dt>
                <dd className="font-semibold text-zinc-900">{project.trackName}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <p className="mt-10 text-center text-sm text-zinc-500">
        Explore more in the{" "}
        <Link href="/projects" className="font-semibold text-violet-600 hover:text-violet-800">
          public gallery
        </Link>
        .
      </p>
    </PageShell>
  );
}
