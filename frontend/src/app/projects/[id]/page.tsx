import { ProjectComments } from "@/components/ProjectComments";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageShell } from "@/components/ui/PageShell";
import { formatDateTime } from "@/lib/format";
import { videoEmbedUrl } from "@/lib/galleryUtils";
import { ProjectCover } from "@/components/ProjectCard";
import { fetchProjectDetail } from "@/lib/server-api";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const project = await fetchProjectDetail(id);

  if (!project) {
    notFound();
  }

  const isDraft = project.status === "DRAFT";
  const embed = videoEmbedUrl(project.videoUrl ?? project.demoUrl);
  const links = [
    { href: project.liveUrl, label: "Live demo" },
    { href: project.repoUrl, label: "Source code" },
    { href: embed ? null : (project.videoUrl ?? project.demoUrl), label: "Watch demo video" },
  ].filter((link): link is { href: string; label: string } => Boolean(link.href));
  const answered = (project.questions ?? []).filter((q) => q.answer);

  return (
    <PageShell
      eyebrow={[project.event?.name, project.trackName].filter(Boolean).join(" · ")}
      title={project.title || "Untitled project"}
      description={project.tagline ?? undefined}
      badge={
        <Badge tone={isDraft ? "warning" : "success"}>{isDraft ? "Draft" : "Submitted"}</Badge>
      }
      action={
        <>
          {project.canEdit && project.event ? (
            <ButtonLink href={`/projects/new?event=${project.event.slug}`} size="sm">
              Edit project
            </ButtonLink>
          ) : null}
          <ButtonLink
            href={project.event ? `/projects?event=${project.event.slug}` : "/projects"}
            variant="secondary"
            size="sm"
          >
            Back to gallery
          </ButtonLink>
        </>
      }
    >
      {isDraft ? (
        <div className="mb-8">
          <Alert tone="warning" title="This is a draft">
            Only your team and event staff can see this page. Submit it before{" "}
            {formatDateTime(project.event?.submissionsClose)} to appear in the gallery.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card variant="elevated" className="overflow-hidden p-0">
            {embed ? (
              <div className="aspect-video bg-black">
                <iframe
                  src={embed}
                  title={`${project.title} demo video`}
                  className="h-full w-full"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              <div className="aspect-[16/9]">
                <ProjectCover project={project} large />
              </div>
            )}
            <div className="p-6">
              <h2 className="font-display text-lg font-semibold text-ink">About this project</h2>
              {project.summary ? (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                  {project.summary}
                </p>
              ) : (
                <p className="mt-4 text-sm text-zinc-400">No description yet.</p>
              )}
            </div>
          </Card>

          {project.imageUrls.length > 0 ? (
            <Card>
              <h2 className="font-display text-base font-semibold text-ink">Gallery</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {project.imageUrls.map((url, index) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-zinc-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`${project.title} screenshot ${index + 1}`} loading="lazy" className="aspect-[16/10] w-full object-cover transition hover:scale-[1.02]" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {answered.length > 0 ? (
            <Card>
              <h2 className="font-display text-base font-semibold text-ink">Organizer questions</h2>
              <p className="mt-1 text-xs text-zinc-400">Visible to the team, organizers and judges only.</p>
              <dl className="mt-4 space-y-4">
                {answered.map((question) => (
                  <div key={question.id}>
                    <dt className="text-sm font-semibold text-zinc-800">{question.label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{question.answer}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}

          {!isDraft ? (
            <div className="pt-4">
              <ProjectComments projectId={project.id} />
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          {links.length > 0 ? (
            <Card variant="dark">
              <h2 className="font-mono text-[11px] tracking-[0.14em] text-white/55 uppercase">Try it</h2>
              <div className="mt-4 flex flex-col gap-3">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-between rounded-lg bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-signal-300 hover:text-ink"
                  >
                    {link.label} ↗
                  </a>
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <h2 className="font-display text-base font-semibold text-ink">Team</h2>
            <p className="mt-2 text-sm font-semibold text-zinc-700">{project.teamName}</p>
            <ul className="mt-4 space-y-2">
              {project.members.map((member, index) => (
                <li key={`${member.name}-${index}`} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">{member.name}</p>
                    {member.email ? <p className="truncate text-xs text-zinc-500">{member.email}</p> : null}
                  </div>
                  <Badge tone="default">{member.role.toLowerCase()}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <dl className="space-y-3 text-sm">
              {project.event ? (
                <div>
                  <dt className="font-mono text-[11px] tracking-[0.12em] text-zinc-400 uppercase">Event</dt>
                  <dd>
                    <Link href={`/events/${project.event.slug}`} className="font-semibold text-brand-700 hover:underline">
                      {project.event.name}
                    </Link>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="font-mono text-[11px] tracking-[0.12em] text-zinc-400 uppercase">Track</dt>
                <dd className="font-semibold text-zinc-900">{project.trackName ?? "—"}</dd>
              </div>
              {project.submittedAt ? (
                <div>
                  <dt className="font-mono text-[11px] tracking-[0.12em] text-zinc-400 uppercase">Submitted</dt>
                  <dd className="font-semibold text-zinc-900">{formatDateTime(project.submittedAt)}</dd>
                </div>
              ) : null}
              {project.techTags.length > 0 ? (
                <div>
                  <dt className="font-mono text-[11px] tracking-[0.12em] text-zinc-400 uppercase">Built with</dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {project.techTags.map((tag) => (
                      <Link
                        key={tag}
                        href={`/projects?tag=${encodeURIComponent(tag)}`}
                        className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700 hover:bg-signal-200"
                      >
                        {tag}
                      </Link>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
