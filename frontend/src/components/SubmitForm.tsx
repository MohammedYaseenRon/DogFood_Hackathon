"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FormPageLayout } from "@/components/ui/FormPageLayout";
import {
  fetchEventClient,
  fetchMyProjectClient,
  saveProjectClient,
  type EventInfo,
  type ProjectDetail,
  type ProjectPayload,
  type ProjectStatus,
} from "@/lib/api";
import { formatDateTime, relativeTime } from "@/lib/format";

const MAX_IMAGES = 8;
const MAX_TAGS = 15;
const SUMMARY_LIMIT = 10000;
const URL_RE = /^https?:\/\/\S+$/i;

type FormState = {
  title: string;
  trackId: string;
  tagline: string;
  summary: string;
  repoUrl: string;
  liveUrl: string;
  videoUrl: string;
  thumbnailUrl: string;
  imageUrls: string[];
  techTags: string[];
  answers: Record<string, string>;
};

const EMPTY: FormState = {
  title: "",
  trackId: "",
  tagline: "",
  summary: "",
  repoUrl: "",
  liveUrl: "",
  videoUrl: "",
  thumbnailUrl: "",
  imageUrls: [],
  techTags: [],
  answers: {},
};

function fromProject(project: ProjectDetail): FormState {
  return {
    title: project.title ?? "",
    trackId: project.trackId ?? "",
    tagline: project.tagline ?? "",
    summary: project.summary ?? "",
    repoUrl: project.repoUrl ?? "",
    liveUrl: project.liveUrl ?? "",
    videoUrl: project.videoUrl ?? project.demoUrl ?? "",
    thumbnailUrl: project.thumbnailUrl ?? "",
    imageUrls: project.imageUrls ?? [],
    techTags: project.techTags ?? [],
    answers: project.answers ?? {},
  };
}

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 transition placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100 disabled:bg-zinc-50 disabled:text-zinc-500";

type Loaded =
  | { ok: true; event: EventInfo | null; teamName: string; project: ProjectDetail | null }
  | { ok: false; status: number; message: string };

async function fetchSubmission(eventSlug?: string): Promise<Loaded> {
  const mine = await fetchMyProjectClient(eventSlug);
  if (!mine.data) {
    return { ok: false, status: mine.status, message: mine.error ?? "Could not load your submission." };
  }
  const event = await fetchEventClient(mine.data.event.slug);
  return { ok: true, event, teamName: mine.data.team.name, project: mine.data.project };
}

export function SubmitForm({ eventSlug }: { eventSlug?: string }) {
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [teamName, setTeamName] = useState<string>("");
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saved, setSaved] = useState<FormState>(EMPTY);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ProjectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [imageDraft, setImageDraft] = useState("");

  useEffect(() => {
    let active = true;
    fetchSubmission(eventSlug).then((loaded) => {
      if (!active) return;
      if (!loaded.ok) {
        setLoadError({ status: loaded.status, message: loaded.message });
      } else {
        setEvent(loaded.event);
        setTeamName(loaded.teamName);
        setProject(loaded.project);
        const initial = loaded.project
          ? fromProject(loaded.project)
          : { ...EMPTY, trackId: loaded.event?.tracks[0]?.id ?? "" };
        setForm(initial);
        setSaved(initial);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [eventSlug]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const closed = !event?.state.submissionsOpen;
  const status = project?.status ?? null;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addTags(raw: string) {
    const incoming = raw
      .split(",")
      .map((tag) => tag.trim().replace(/\s+/g, " ").slice(0, 40))
      .filter(Boolean);
    if (!incoming.length) return;
    setForm((prev) => {
      const next = [...prev.techTags];
      for (const tag of incoming) {
        if (next.length >= MAX_TAGS) break;
        if (!next.some((t) => t.toLowerCase() === tag.toLowerCase())) next.push(tag);
      }
      return { ...prev, techTags: next };
    });
    setTagDraft("");
  }

  function addImage() {
    const url = imageDraft.trim();
    if (!url) return;
    if (!URL_RE.test(url)) {
      setError("Image links must start with http:// or https://");
      return;
    }
    if (form.imageUrls.length >= MAX_IMAGES) return;
    if (!form.imageUrls.includes(url)) set("imageUrls", [...form.imageUrls, url]);
    setImageDraft("");
    setError(null);
  }

  /** Mirrors the server rules so problems show before the round trip. */
  function clientProblems(target: ProjectStatus): string[] {
    const problems: string[] = [];
    if (!form.title.trim()) problems.push("a project name");
    if (!form.trackId) problems.push("a track");
    const urls: Array<[string, string]> = [
      ["Repository URL", form.repoUrl],
      ["Live link", form.liveUrl],
      ["Demo video URL", form.videoUrl],
      ["Thumbnail URL", form.thumbnailUrl],
    ];
    for (const [label, value] of urls) {
      if (value.trim() && !URL_RE.test(value.trim())) problems.push(`a valid ${label} (http/https)`);
    }
    if (target === "SUBMITTED") {
      if (!form.summary.trim()) problems.push("a description");
      if (!form.repoUrl.trim()) problems.push("a repository URL");
      for (const question of event?.questions ?? []) {
        if (question.required && !(form.answers[question.id] ?? "").trim()) {
          problems.push(`an answer to "${question.label}"`);
        }
      }
    }
    return problems;
  }

  async function save(target: ProjectStatus) {
    setError(null);
    setMessage(null);
    if (closed || !event) {
      setError("Submissions are closed — changes can't be saved.");
      return;
    }
    const problems = clientProblems(target);
    if (problems.length) {
      setError(
        `${target === "SUBMITTED" ? "To submit, add" : "Add"} ${problems.join(", ")}.` +
          (target === "SUBMITTED" ? " You can still save a draft." : ""),
      );
      return;
    }

    const payload: ProjectPayload = {
      event: event.slug,
      title: form.title.trim(),
      track_id: form.trackId,
      tagline: form.tagline.trim(),
      summary: form.summary.trim(),
      repo_url: form.repoUrl.trim(),
      live_url: form.liveUrl.trim(),
      video_url: form.videoUrl.trim(),
      thumbnail_url: form.thumbnailUrl.trim(),
      image_urls: form.imageUrls,
      tech_tags: form.techTags,
      answers: Object.fromEntries(
        (event.questions ?? []).map((q) => [q.id, (form.answers[q.id] ?? "").trim()]),
      ),
      status: target,
    };

    setSaving(target);
    const result = await saveProjectClient(payload, project?.id);
    setSaving(null);

    if (result.error || !result.project) {
      setError(result.error ?? "Could not save.");
      return;
    }
    setProject(result.project);
    const next = fromProject(result.project);
    setForm(next);
    setSaved(next);
    setMessage(
      target === "SUBMITTED"
        ? status === "SUBMITTED"
          ? "Changes saved. Your submission is up to date."
          : "Submitted! Your project is now in the public gallery. You can keep editing until the deadline."
        : status === "SUBMITTED"
          ? "Moved back to draft. It's hidden from the gallery until you submit again."
          : "Draft saved. Only your team can see it.",
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
      </div>
    );
  }

  if (loadError || !event) {
    const noTeam = loadError?.status === 403;
    return (
      <FormPageLayout eyebrow="Submission" title={noTeam ? "Join a team first" : "Submission unavailable"}>
        <div className="space-y-5">
          <Alert tone={noTeam ? "info" : "error"}>{loadError?.message ?? "Event not found."}</Alert>
          <div className="flex flex-wrap gap-3">
            {noTeam ? (
              <ButtonLink href={eventSlug ? `/teams/new?event=${eventSlug}` : "/teams/new"}>
                Create a team
              </ButtonLink>
            ) : null}
            <ButtonLink href="/participant" variant="secondary">
              Participant hub
            </ButtonLink>
          </div>
        </div>
      </FormPageLayout>
    );
  }

  const readOnly = closed;
  const statusLabel = status === "SUBMITTED" ? "Submitted" : status === "DRAFT" ? "Draft" : "Not started";

  return (
    <FormPageLayout
      eyebrow={`Submission · ${event.name}`}
      title={project ? form.title || "Your project" : "Start your submission"}
      description={`Team ${teamName}. Save drafts as often as you like — only a submitted project appears in the gallery.`}
      aside={
        <div className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold tracking-[0.16em] text-zinc-400 uppercase">Status</p>
            <div className="mt-4 space-y-3">
              <InfoRow label="Your project" value={statusLabel} tone={status === "SUBMITTED" ? "open" : undefined} />
              <InfoRow
                label="Deadline"
                value={`${formatDateTime(event.submissionsClose)}${closed ? "" : ` · ${relativeTime(event.submissionsClose)}`}`}
                tone={closed ? "closed" : undefined}
              />
              <InfoRow label="Submissions" value={closed ? "Closed" : "Open"} tone={closed ? "closed" : "open"} />
            </div>
            {project ? (
              <Link href={`/projects/${project.id}`} className="mt-5 inline-flex text-sm font-semibold text-brand-700 hover:underline">
                {status === "SUBMITTED" ? "View public page →" : "Preview (team only) →"}
              </Link>
            ) : null}
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-zinc-900">To submit you need</p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <Check done={Boolean(form.title.trim())}>Project name & track</Check>
              <Check done={Boolean(form.summary.trim())}>Description</Check>
              <Check done={Boolean(form.repoUrl.trim())}>Repository URL</Check>
              {(event.questions ?? [])
                .filter((q) => q.required)
                .map((q) => (
                  <Check key={q.id} done={Boolean((form.answers[q.id] ?? "").trim())}>
                    {q.label}
                  </Check>
                ))}
            </ul>
            <p className="mt-4 text-xs text-zinc-400">Everything else is optional but helps judges.</p>
          </div>
        </div>
      }
    >
      <div className="relative space-y-8">
        {closed ? (
          <Alert tone="warning" title="Submissions are closed">
            The deadline was {formatDateTime(event.submissionsClose)}. Your project is locked
            {status === "SUBMITTED" ? " as submitted" : status === "DRAFT" ? " as a draft and was not submitted" : ""}.
          </Alert>
        ) : status === "SUBMITTED" ? (
          <Alert tone="success" title="Submitted">
            Your project is live in the gallery. Edits you save here update it immediately until the deadline.
          </Alert>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save("SUBMITTED");
          }}
          className="space-y-10"
        >
          <fieldset disabled={readOnly} className="space-y-10">
            <section className="space-y-5">
              <SectionHeader title="Basics" description="What judges and gallery visitors see first." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Project name *" htmlFor="p-title">
                  <input id="p-title" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} className={inputClass} placeholder="My awesome hack" />
                </Field>
                <Field label="Track *" htmlFor="p-track">
                  <select id="p-track" value={form.trackId} onChange={(e) => set("trackId", e.target.value)} className={inputClass}>
                    {event.tracks.map((track) => (
                      <option key={track.id} value={track.id}>
                        {track.name}
                      </option>
                    ))}
                    {form.trackId && !event.tracks.some((t) => t.id === form.trackId) ? (
                      <option value={form.trackId}>{project?.trackName ?? "Retired track"} (retired)</option>
                    ) : null}
                  </select>
                </Field>
                <Field label="Tagline" htmlFor="p-tagline" className="sm:col-span-2" hint={`${form.tagline.length}/300`}>
                  <input id="p-tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={300} className={inputClass} placeholder="One line pitch for the gallery card" />
                </Field>
                <Field
                  label="Description *"
                  htmlFor="p-summary"
                  className="sm:col-span-2"
                  hint={`What it does, how you built it, what's next. ${form.summary.length}/${SUMMARY_LIMIT}`}
                >
                  <textarea id="p-summary" value={form.summary} onChange={(e) => set("summary", e.target.value)} rows={8} maxLength={SUMMARY_LIMIT} className={inputClass} placeholder="Describe the problem, your solution, and the tech behind it." />
                </Field>
              </div>
            </section>

            <section className="space-y-5">
              <SectionHeader title="Links" description="Where judges can see and run your work." />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Repository URL *" htmlFor="p-repo" className="sm:col-span-2">
                  <input id="p-repo" type="url" value={form.repoUrl} onChange={(e) => set("repoUrl", e.target.value)} className={inputClass} placeholder="https://github.com/you/project" />
                </Field>
                <Field label="Live link" htmlFor="p-live">
                  <input id="p-live" type="url" value={form.liveUrl} onChange={(e) => set("liveUrl", e.target.value)} className={inputClass} placeholder="https://your-demo.example" />
                </Field>
                <Field label="Demo video URL" htmlFor="p-video" hint="YouTube, Vimeo or Loom links are embedded.">
                  <input id="p-video" type="url" value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} className={inputClass} placeholder="https://youtube.com/watch?v=…" />
                </Field>
              </div>
            </section>

            <section className="space-y-5">
              <SectionHeader title="Media" description="Hosted image links — nothing is uploaded to this server." />
              <Field label="Thumbnail URL" htmlFor="p-thumb" hint="Shown on the gallery card. 16:10 works best.">
                <div className="flex gap-3">
                  <input id="p-thumb" type="url" value={form.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} className={inputClass} placeholder="https://…/cover.png" />
                  {URL_RE.test(form.thumbnailUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.thumbnailUrl} alt="" className="h-12 w-20 shrink-0 rounded-lg border border-zinc-200 object-cover" />
                  ) : null}
                </div>
              </Field>
              <div>
                <p className="mb-2 text-sm font-semibold text-zinc-700">
                  Image gallery <span className="font-normal text-zinc-400">({form.imageUrls.length}/{MAX_IMAGES})</span>
                </p>
                {form.imageUrls.length ? (
                  <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {form.imageUrls.map((url, index) => (
                      <li key={url} className="group relative overflow-hidden rounded-lg border border-zinc-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Screenshot ${index + 1}`} className="aspect-[16/10] w-full object-cover" />
                        {!readOnly ? (
                          <button
                            type="button"
                            onClick={() => set("imageUrls", form.imageUrls.filter((u) => u !== url))}
                            className="absolute right-1.5 top-1.5 rounded-md bg-black/60 px-2 py-0.5 text-xs font-semibold text-white"
                            aria-label={`Remove image ${index + 1}`}
                          >
                            ✕
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {form.imageUrls.length < MAX_IMAGES ? (
                  <div className="flex gap-2">
                    <input
                      aria-label="Add image URL"
                      type="url"
                      value={imageDraft}
                      onChange={(e) => setImageDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addImage();
                        }
                      }}
                      className={inputClass}
                      placeholder="https://…/screenshot.png"
                    />
                    <Button type="button" variant="secondary" onClick={addImage}>
                      Add
                    </Button>
                  </div>
                ) : null}
              </div>
              <div>
                <label htmlFor="p-tags" className="mb-2 block text-sm font-semibold text-zinc-700">
                  Tech tags <span className="font-normal text-zinc-400">({form.techTags.length}/{MAX_TAGS})</span>
                </label>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                  {form.techTags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                      {tag}
                      {!readOnly ? (
                        <button type="button" aria-label={`Remove ${tag}`} onClick={() => set("techTags", form.techTags.filter((t) => t !== tag))} className="text-brand-400 hover:text-brand-800">
                          ×
                        </button>
                      ) : null}
                    </span>
                  ))}
                  <input
                    id="p-tags"
                    value={tagDraft}
                    onChange={(e) => {
                      if (e.target.value.includes(",")) addTags(e.target.value);
                      else setTagDraft(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTags(tagDraft);
                      } else if (e.key === "Backspace" && !tagDraft && form.techTags.length) {
                        set("techTags", form.techTags.slice(0, -1));
                      }
                    }}
                    onBlur={() => addTags(tagDraft)}
                    className="min-w-[8rem] flex-1 border-0 p-1 text-sm focus:outline-none"
                    placeholder={form.techTags.length ? "" : "React, Python, Postgres…"}
                  />
                </div>
                <p className="mt-1.5 text-xs text-zinc-400">Press Enter or comma to add. Used for gallery filtering.</p>
              </div>
            </section>

            {(event.questions ?? []).length > 0 ? (
              <section className="space-y-5">
                <SectionHeader title="Organizer questions" description="Visible to your team, organizers and judges only." />
                {event.questions.map((question) => {
                  const id = `q-${question.id}`;
                  const value = form.answers[question.id] ?? "";
                  const update = (next: string) => set("answers", { ...form.answers, [question.id]: next });
                  return (
                    <Field key={question.id} label={`${question.label}${question.required ? " *" : ""}`} htmlFor={id}>
                      {question.type === "textarea" ? (
                        <textarea id={id} rows={4} value={value} onChange={(e) => update(e.target.value)} maxLength={5000} className={inputClass} />
                      ) : question.type === "select" ? (
                        <select id={id} value={value} onChange={(e) => update(e.target.value)} className={inputClass}>
                          <option value="">Choose…</option>
                          {question.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input id={id} type={question.type === "url" ? "url" : "text"} value={value} onChange={(e) => update(e.target.value)} maxLength={5000} className={inputClass} />
                      )}
                    </Field>
                  );
                })}
              </section>
            ) : null}
          </fieldset>

          {error ? <Alert tone="error">{error}</Alert> : null}
          {message ? <Alert tone="success">{message}</Alert> : null}

          {!readOnly ? (
            <div className="flex flex-col gap-4 border-t border-zinc-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-500">
                {dirty ? <Badge tone="warning">Unsaved changes</Badge> : project ? "All changes saved." : "Nothing saved yet."}
              </p>
              <div className="flex flex-wrap gap-3">
                {status === "SUBMITTED" ? (
                  <>
                    <Button type="button" variant="ghost" disabled={saving !== null} onClick={() => void save("DRAFT")}>
                      {saving === "DRAFT" ? "Saving…" : "Unsubmit (back to draft)"}
                    </Button>
                    <Button type="submit" size="lg" disabled={saving !== null || !dirty}>
                      {saving === "SUBMITTED" ? "Saving…" : "Save changes"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="secondary" disabled={saving !== null} onClick={() => void save("DRAFT")}>
                      {saving === "DRAFT" ? "Saving…" : "Save draft"}
                    </Button>
                    <Button type="submit" size="lg" disabled={saving !== null}>
                      {saving === "SUBMITTED" ? "Submitting…" : "Submit project"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </FormPageLayout>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-zinc-100 pb-3">
      <h2 className="text-sm font-bold tracking-wide text-zinc-900 uppercase">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-zinc-700">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}

function Check({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400"
        }`}
      >
        {done ? "✓" : "·"}
      </span>
      <span className={done ? "text-zinc-800" : ""}>{children}</span>
    </li>
  );
}

function InfoRow({ label, value, tone }: { label: string; value: string; tone?: "open" | "closed" }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-canvas px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p
        className={`mt-1 text-sm font-semibold ${
          tone === "open" ? "text-emerald-700" : tone === "closed" ? "text-amber-700" : "text-zinc-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
