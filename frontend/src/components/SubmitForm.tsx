"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormPageLayout } from "@/components/ui/FormPageLayout";
import {
  fetchMyProjectClient,
  saveProjectClient,
  type EventInfo,
} from "@/lib/api";

export function SubmitForm({ event }: { event: EventInfo | null }) {
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [summary, setSummary] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [techTags, setTechTags] = useState("");
  const [trackId, setTrackId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<"DRAFT" | "SUBMITTED" | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const closed = event ? !event.state?.submissionsOpen : true;

  useEffect(() => {
    fetchMyProjectClient().then((data) => {
      const project = data?.project ?? null;
      if (project) {
        setProjectId(project.id);
        setTitle(project.title);
        setTagline(project.tagline ?? "");
        setSummary(project.summary);
        setRepoUrl(project.repoUrl);
        setLiveUrl(project.liveUrl ?? "");
        setVideoUrl(project.videoUrl ?? "");
        setThumbnailUrl(project.thumbnailUrl ?? "");
        setTechTags((project.techTags ?? []).join(", "));
        setTrackId(project.trackId);
        setProjectStatus(project.status);
      } else if (event?.tracks[0]) {
        setTrackId(event.tracks[0].id);
      }
      setLoading(false);
    });
  }, [event]);

  async function save(status: "DRAFT" | "SUBMITTED") {
    setError(null);
    setMessage(null);

    if (closed) {
      setError("Submissions are closed — edits cannot be saved.");
      return;
    }

    if (!trackId) {
      setError("Select a track.");
      return;
    }

    setSaving(true);
    const { project, error: saveError } = await saveProjectClient(
      {
        title,
        tagline: tagline.trim() || undefined,
        summary,
        repo_url: repoUrl,
        live_url: liveUrl.trim() || undefined,
        video_url: videoUrl.trim() || undefined,
        thumbnail_url: thumbnailUrl.trim() || undefined,
        tech_tags: techTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        track_id: trackId,
        status,
      },
      projectId ?? undefined,
    );
    setSaving(false);

    if (saveError) {
      setError(saveError);
      return;
    }

    if (project) {
      setProjectId(project.id);
      setProjectStatus(project.status);
    }

    setMessage(
      status === "DRAFT"
        ? "Draft saved. You can keep editing until the deadline."
        : "Project submitted to the gallery.",
    );
  }

  const inputClass =
    "relative z-10 w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 transition placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100";

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-[#f4f5f7]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
      </div>
    );
  }

  const deadline = event
    ? new Date(event.submissionsClose).toLocaleString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not set";

  return (
    <FormPageLayout
      eyebrow="Submission"
      title="Submit a project"
      description="Create or edit your team's hackathon submission."
      aside={
        <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold tracking-[0.16em] text-zinc-400 uppercase">
            Submission guide
          </p>

          <div className="mt-6 space-y-4">
            <InfoRow
              label="Status"
              value={closed ? "Closed" : "Open"}
              tone={closed ? "closed" : "open"}
            />
            <InfoRow label="Deadline" value={deadline} />
            <InfoRow
              label="Your project"
              value={
                projectStatus === "SUBMITTED"
                  ? "Submitted"
                  : projectStatus === "DRAFT"
                    ? "Draft"
                    : "Not started"
              }
            />
          </div>

          <div className="mt-8">
            <p className="text-sm font-semibold text-zinc-900">Checklist</p>
            <ul className="mt-4 space-y-3 text-sm text-zinc-600">
              {[
                "Pick the right track for your project",
                "Write a clear tagline and summary",
                "Add repo, demo, and video links",
                "Save a draft before final submit",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {event?.tracks?.length ? (
            <div className="mt-8 border-t border-zinc-100 pt-6">
              <p className="text-sm font-semibold text-zinc-900">Tracks</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {event.tracks.map((track) => (
                  <span
                    key={track.id}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700"
                  >
                    {track.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      }
    >
      <div className="relative space-y-8">
        {closed ? (
          <Alert tone="warning" title="Submissions closed">
            The deadline was {deadline}. You can review fields below, but saves
            are blocked until the organizer reopens submissions.
          </Alert>
        ) : (
          <Alert tone="success" title="Submissions open">
            Save a draft or submit your final project before the deadline.
            {projectStatus === "DRAFT" ? " Your project is currently a draft." : null}
            {projectStatus === "SUBMITTED" ? " Your project is submitted." : null}
          </Alert>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save("SUBMITTED");
          }}
          className="relative space-y-10"
        >
          <section className="space-y-5">
            <SectionHeader
              title="Project basics"
              description="What judges and gallery visitors will see first."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Project title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="My awesome hack"
                />
              </Field>
              <Field label="Track">
                <select
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                  className={inputClass}
                >
                  {(event?.tracks ?? []).map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tagline" className="sm:col-span-2">
                <input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className={inputClass}
                  placeholder="One-line pitch for the gallery"
                />
              </Field>
              <Field label="Summary" className="sm:col-span-2">
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  required
                  rows={4}
                  className={inputClass}
                  placeholder="Describe what it does and why it matters"
                />
              </Field>
            </div>
          </section>

          <section className="space-y-5">
            <SectionHeader
              title="Links & media"
              description="Repo, demo, and visuals for your submission."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Repository URL" className="sm:col-span-2">
                <input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  required
                  type="url"
                  className={inputClass}
                  placeholder="https://github.com/..."
                />
              </Field>
              <Field label="Live demo URL">
                <input
                  value={liveUrl}
                  onChange={(e) => setLiveUrl(e.target.value)}
                  type="url"
                  className={inputClass}
                  placeholder="https://..."
                />
              </Field>
              <Field label="Demo video URL">
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  type="url"
                  className={inputClass}
                  placeholder="https://youtube.com/..."
                />
              </Field>
              <Field label="Thumbnail URL">
                <input
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  type="url"
                  className={inputClass}
                  placeholder="https://..."
                />
              </Field>
              <Field label="Tech tags">
                <input
                  value={techTags}
                  onChange={(e) => setTechTags(e.target.value)}
                  className={inputClass}
                  placeholder="React, Python, PostgreSQL"
                />
              </Field>
            </div>
          </section>

          <div className="flex flex-col gap-4 border-t border-zinc-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-500">
              {closed
                ? "Fields are editable for preview — saving is disabled while closed."
                : "Save a draft anytime, then submit when you're ready."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={closed || saving}
                onClick={() => void save("DRAFT")}
              >
                {saving ? "Saving..." : "Save draft"}
              </Button>
              <Button type="submit" disabled={closed || saving} size="lg">
                {saving
                  ? "Saving..."
                  : projectId
                    ? "Update submission"
                    : "Submit project"}
              </Button>
            </div>
          </div>
        </form>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
      </div>
    </FormPageLayout>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-zinc-100 pb-3">
      <h2 className="text-sm font-bold tracking-wide text-zinc-900 uppercase">
        {title}
      </h2>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-semibold text-zinc-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "open" | "closed";
}) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-[#fafafa] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-semibold ${
          tone === "open"
            ? "text-emerald-700"
            : tone === "closed"
              ? "text-amber-700"
              : "text-zinc-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
