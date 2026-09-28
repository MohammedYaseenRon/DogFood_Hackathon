"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
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

const inputClass = "field";

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
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-ink" />
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
          <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white">
            <div aria-hidden className="graph-paper-dark absolute inset-0" />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">Deadline</p>
                <Countdown to={event.submissionsClose} tone="dark" closedLabel="Closed" />
              </div>
              <p className="font-display mt-3 text-lg leading-snug font-semibold">
                {formatDateTime(event.submissionsClose)}
              </p>
              {!closed ? (
                <p className="mt-1 text-sm text-white/55">{relativeTime(event.submissionsClose)}</p>
              ) : null}
              <dl className="mt-5 space-y-2.5 border-t border-dashed border-white/15 pt-4 text-sm">
                <InfoRow label="Your project" value={statusLabel} tone={status === "SUBMITTED" ? "open" : undefined} />
                <InfoRow label="Submissions" value={closed ? "Closed" : "Open"} tone={closed ? "closed" : "open"} />
                <InfoRow label="Team" value={teamName} />
              </dl>
              {project ? (
                <Link
                  href={`/projects/${project.id}`}
                  className="mt-5 inline-flex text-sm font-semibold text-signal-300 underline-offset-4 hover:underline"
                >
                  {status === "SUBMITTED" ? "View public page →" : "Preview (team only) →"}
                </Link>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6">
            <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500 uppercase">To submit you need</p>
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
            <p className="mt-4 border-t border-line pt-3 text-xs text-zinc-400">Everything else is optional but helps judges.</p>
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
              <SectionHeader step={1} title="Basics" description="What judges and gallery visitors see first." />
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
              <SectionHeader step={2} title="Links" description="Where judges can see and run your work." />
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
              <SectionHeader step={3} title="Media" description="Hosted image links — nothing is uploaded to this server." />
              <Field label="Thumbnail URL" htmlFor="p-thumb" hint="Shown on the gallery card. 16:10 works best.">
                <div className="flex gap-3">
                  <input id="p-thumb" type="url" value={form.thumbnailUrl} onChange={(e) => set("thumbnailUrl", e.target.value)} className={inputClass} placeholder="https://…/cover.png" />
                  {URL_RE.test(form.thumbnailUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.thumbnailUrl} alt="" className="h-12 w-20 shrink-0 rounded-lg border border-line object-cover" />
                  ) : null}
                </div>
              </Field>
              <div>
                <p className="field-label">
                  Image gallery <span className="font-normal text-zinc-400">({form.imageUrls.length}/{MAX_IMAGES})</span>
                </p>
                {form.imageUrls.length ? (
                  <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {form.imageUrls.map((url, index) => (
                      <li key={url} className="group relative overflow-hidden rounded-lg border border-line bg-zinc-100">
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
                <label htmlFor="p-tags" className="field-label">
                  Tech tags <span className="font-normal text-zinc-400">({form.techTags.length}/{MAX_TAGS})</span>
                </label>
                <div className="field flex flex-wrap items-center gap-2 px-2.5 py-2 focus-within:border-brand-600 focus-within:shadow-[0_0_0_3px_rgba(42,75,223,0.14)]">
                  {form.techTags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 font-mono text-xs font-medium text-brand-700 ring-1 ring-brand-200 ring-inset">
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
                <SectionHeader step={4} title="Organizer questions" description="Visible to your team, organizers and judges only." />
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
            <div className="sticky bottom-4 z-10 flex flex-col gap-4 rounded-xl border border-line bg-white/90 p-4 shadow-[0_12px_32px_-12px_rgba(21,19,43,0.25)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
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

function SectionHeader({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 border-b border-line pb-4">
      <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-sm font-semibold text-signal-300">
        {step}
      </span>
      <div>
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-zinc-500">{description}</p>
      </div>
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
      <label htmlFor={htmlFor} className="field-label">
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
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
          done ? "bg-signal-300 text-ink" : "border border-dashed border-zinc-300 text-transparent"
        }`}
      >
        ✓
      </span>
      <span className={done ? "text-zinc-400 line-through decoration-zinc-300" : "text-ink"}>
        {children}
        <span className="sr-only">{done ? " (done)" : " (missing)"}</span>
      </span>
    </li>
  );
}

function InfoRow({ label, value, tone }: { label: string; value: string; tone?: "open" | "closed" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/55">{label}</dt>
      <dd
        className={`truncate font-semibold ${
          tone === "open" ? "text-emerald-300" : tone === "closed" ? "text-amber-300" : "text-white"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
