"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Countdown } from "@/components/ui/Countdown";
import {
  createEventClient,
  updateEventClient,
  type EventInfo,
  type EventPayload,
  type QuestionType,
} from "@/lib/api";
import { formatDateTime, fromLocalInput, toLocalInput } from "@/lib/format";

type TrackRow = { id?: string; name: string; description: string };
type PrizeRow = { name: string; amount: string; rank: number; trackIndex: number | "" };
type QuestionRow = {
  id?: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string;
};

type DateKey =
  | "registration_opens"
  | "registration_closes"
  | "event_starts"
  | "event_ends"
  | "submissions_close"
  | "judging_starts"
  | "judging_ends"
  | "results_at";

const DATE_FIELDS: Array<{ key: DateKey; label: string; hint: string; required?: boolean }> = [
  { key: "registration_opens", label: "Registration opens", hint: "Participants can register and form teams from here." },
  { key: "registration_closes", label: "Registration closes", hint: "Leave empty to allow registration until the deadline." },
  { key: "event_starts", label: "Hacking starts", hint: "Projects can be created from this moment." },
  { key: "event_ends", label: "Hacking ends", hint: "Shown on the timeline." },
  { key: "submissions_close", label: "Submission deadline", hint: "Hard stop: no creates or edits after this.", required: true },
  { key: "judging_starts", label: "Judging starts", hint: "Must be after the deadline." },
  { key: "judging_ends", label: "Judging ends", hint: "" },
  { key: "results_at", label: "Results announced", hint: "" },
];

// Mirrors the server-side ordering rules so mistakes show before saving.
const ORDER_RULES: Array<[DateKey, DateKey, string]> = [
  ["registration_opens", "registration_closes", "Registration must open before it closes"],
  ["registration_opens", "submissions_close", "Registration must open before the submission deadline"],
  ["event_starts", "event_ends", "Hacking must start before it ends"],
  ["event_starts", "submissions_close", "Hacking must start before the submission deadline"],
  ["submissions_close", "judging_starts", "Judging cannot start before submissions close"],
  ["judging_starts", "judging_ends", "Judging must start before it ends"],
  ["submissions_close", "results_at", "Results cannot come before the submission deadline"],
  ["judging_ends", "results_at", "Results cannot come before judging ends"],
];

const inputClass = "field";

function isoToInput(event: EventInfo | null | undefined, key: DateKey): string {
  if (!event) return "";
  const map: Record<DateKey, string | null | undefined> = {
    registration_opens: event.registrationOpens,
    registration_closes: event.registrationCloses,
    event_starts: event.eventStarts,
    event_ends: event.eventEnds,
    submissions_close: event.submissionsClose,
    judging_starts: event.judgingStarts,
    judging_ends: event.judgingEnds,
    results_at: event.resultsAt,
  };
  return toLocalInput(map[key]);
}

export function EventForm({
  mode,
  initialEvent,
}: {
  mode: "create" | "edit";
  initialEvent?: EventInfo | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialEvent?.name ?? "");
  const [slug, setSlug] = useState(initialEvent?.slug ?? "");
  const [shortDescription, setShortDescription] = useState(initialEvent?.shortDescription ?? "");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [published, setPublished] = useState(initialEvent?.published ?? true);
  const [maxTeamSize, setMaxTeamSize] = useState(initialEvent?.maxTeamSize ?? 4);
  const [dates, setDates] = useState<Record<DateKey, string>>(() => {
    const entries = DATE_FIELDS.map(({ key }) => [key, isoToInput(initialEvent, key)]);
    return Object.fromEntries(entries) as Record<DateKey, string>;
  });
  const [tracks, setTracks] = useState<TrackRow[]>(
    initialEvent?.tracks.map((t) => ({ id: t.id, name: t.name, description: t.description ?? "" })) ?? [
      { name: "General", description: "" },
    ],
  );
  const [prizes, setPrizes] = useState<PrizeRow[]>(() =>
    (initialEvent?.prizes ?? []).map((p) => {
      const idx = initialEvent?.tracks.findIndex((t) => t.id === p.trackId) ?? -1;
      return { name: p.name, amount: p.amount, rank: p.rank, trackIndex: idx >= 0 ? idx : "" };
    }),
  );
  const [questions, setQuestions] = useState<QuestionRow[]>(
    (initialEvent?.questions ?? []).map((q) => ({
      id: q.id,
      label: q.label,
      type: q.type,
      required: q.required,
      options: q.options.join("\n"),
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dateErrors = useMemo(() => {
    const errors: string[] = [];
    for (const [a, b, message] of ORDER_RULES) {
      if (dates[a] && dates[b] && new Date(dates[a]) > new Date(dates[b])) errors.push(message);
    }
    return errors;
  }, [dates]);

  function setDate(key: DateKey, value: string) {
    setDates((prev) => ({ ...prev, [key]: value }));
  }

  function removeTrack(index: number) {
    setTracks((prev) => prev.filter((_, i) => i !== index));
    setPrizes((prev) =>
      prev.map((p) => {
        if (p.trackIndex === "") return p;
        if (p.trackIndex === index) return { ...p, trackIndex: "" };
        if (p.trackIndex > index) return { ...p, trackIndex: p.trackIndex - 1 };
        return p;
      }),
    );
  }

  function moveTrack(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= tracks.length) return;
    setTracks((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setPrizes((prev) =>
      prev.map((p) =>
        p.trackIndex === index
          ? { ...p, trackIndex: target }
          : p.trackIndex === target
            ? { ...p, trackIndex: index }
            : p,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trackList = tracks
      .map((t) => ({ id: t.id, name: t.name.trim(), description: t.description.trim() || undefined }))
      .filter((t) => t.name);
    if (trackList.length === 0) {
      setError("Add at least one track.");
      return;
    }
    if (!dates.submissions_close) {
      setError("Set a submission deadline.");
      return;
    }
    if (dateErrors.length) {
      setError(dateErrors[0]);
      return;
    }

    const payload: EventPayload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      short_description: shortDescription.trim(),
      description: description.trim(),
      published,
      max_team_size: maxTeamSize,
      submissions_close: fromLocalInput(dates.submissions_close) ?? "",
      registration_opens: fromLocalInput(dates.registration_opens),
      registration_closes: fromLocalInput(dates.registration_closes),
      event_starts: fromLocalInput(dates.event_starts),
      event_ends: fromLocalInput(dates.event_ends),
      judging_starts: fromLocalInput(dates.judging_starts),
      judging_ends: fromLocalInput(dates.judging_ends),
      results_at: fromLocalInput(dates.results_at),
      tracks: trackList,
      prizes: prizes
        .filter((p) => p.name.trim() && p.amount.trim())
        .map((p) => ({
          name: p.name.trim(),
          amount: p.amount.trim(),
          rank: p.rank || 1,
          track_index: p.trackIndex === "" ? undefined : p.trackIndex,
        })),
      questions: questions
        .filter((q) => q.label.trim())
        .map((q) => ({
          id: q.id,
          label: q.label.trim(),
          type: q.type,
          required: q.required,
          options: q.type === "select" ? q.options.split("\n").map((o) => o.trim()).filter(Boolean) : [],
        })),
    };

    setSaving(true);
    const result =
      mode === "edit" && initialEvent
        ? await updateEventClient(initialEvent.slug, payload)
        : await createEventClient(payload);
    setSaving(false);

    if (result.error || !result.event) {
      setError(result.error ?? "Could not save the event.");
      return;
    }
    router.push(`/organizer/events/${result.event.slug}?saved=1`);
    router.refresh();
  }

  const submitLabel = saving ? "Saving..." : mode === "edit" ? "Save changes" : "Create event";

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6">
        <Section step={1} title="Event details" description="How the event appears on the public listing.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Event name" htmlFor="ev-name" className="sm:col-span-2">
              <input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} className={inputClass} placeholder="Spring Hack 2026" />
            </Field>
            <Field label="URL slug" htmlFor="ev-slug" hint={`Public page: /events/${slug || "auto-generated-from-name"}`}>
              <input id="ev-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} maxLength={80} className={inputClass} placeholder="spring-hack-2026" />
            </Field>
            <Field label="Max team size" htmlFor="ev-size">
              <input id="ev-size" type="number" min={1} max={20} value={maxTeamSize} onChange={(e) => setMaxTeamSize(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} className={inputClass} />
            </Field>
            <Field label="Tagline" htmlFor="ev-short" className="sm:col-span-2">
              <input id="ev-short" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} maxLength={300} className={inputClass} placeholder="Build the platform that will judge you." />
            </Field>
            <Field label="Description" htmlFor="ev-desc" className="sm:col-span-2">
              <textarea id="ev-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={10000} className={inputClass} placeholder="Rules, themes, eligibility, anything participants should know." />
            </Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-zinc-50 p-4 transition has-[:checked]:border-ink has-[:checked]:bg-signal-50 sm:col-span-2">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="mt-0.5 h-4 w-4 accent-ink" />
              <span>
                <span className="block text-sm font-semibold text-ink">Published</span>
                <span className="block text-sm text-zinc-500">
                  Unpublished events are hidden from the public and accept no registrations or submissions.
                </span>
              </span>
            </label>
          </div>
        </Section>

        <Section step={2} title="Schedule" description="Times are in your local timezone. Only the deadline is required.">
          <div className="grid gap-5 sm:grid-cols-2">
            {DATE_FIELDS.map((field) => (
              <Field key={field.key} label={`${field.label}${field.required ? " *" : ""}`} htmlFor={`ev-${field.key}`} hint={field.hint}>
                <div className="flex gap-2">
                  <input
                    id={`ev-${field.key}`}
                    type="datetime-local"
                    value={dates[field.key]}
                    onChange={(e) => setDate(field.key, e.target.value)}
                    required={field.required}
                    className={inputClass}
                  />
                  {!field.required && dates[field.key] ? (
                    <button type="button" onClick={() => setDate(field.key, "")} className="shrink-0 rounded-lg px-2.5 font-mono text-[11px] tracking-wide text-zinc-500 uppercase hover:bg-zinc-100 hover:text-ink" aria-label={`Clear ${field.label}`}>
                      Clear
                    </button>
                  ) : null}
                </div>
              </Field>
            ))}
          </div>
          {dateErrors.length ? (
            <div className="mt-5">
              <Alert tone="warning" title="Check the schedule">
                <ul className="list-disc pl-5">
                  {dateErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </Alert>
            </div>
          ) : null}
        </Section>

        <Section
          step={3}
         
          title="Tracks"
          description="Participants pick one when submitting. Removing a track that has projects retires it instead."
          action={<Button type="button" variant="secondary" size="sm" onClick={() => setTracks((prev) => [...prev, { name: "", description: "" }])}>+ Add track</Button>}
        >
          <div className="space-y-3">
            {tracks.map((track, index) => (
              <div key={track.id ?? `new-${index}`} className="rounded-xl border border-line bg-zinc-50/70 p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white font-mono text-xs font-semibold text-zinc-500 ring-1 ring-line">{index + 1}</span>
                  <input
                    aria-label={`Track ${index + 1} name`}
                    value={track.name}
                    onChange={(e) => setTracks((prev) => prev.map((t, i) => (i === index ? { ...t, name: e.target.value } : t)))}
                    required
                    maxLength={120}
                    className={inputClass}
                    placeholder="Track name"
                  />
                  <div className="flex shrink-0 gap-1">
                    <IconButton label="Move up" disabled={index === 0} onClick={() => moveTrack(index, -1)}>↑</IconButton>
                    <IconButton label="Move down" disabled={index === tracks.length - 1} onClick={() => moveTrack(index, 1)}>↓</IconButton>
                    {tracks.length > 1 ? (
                      <IconButton label="Remove track" onClick={() => removeTrack(index)} danger>✕</IconButton>
                    ) : null}
                  </div>
                </div>
                <input
                  aria-label={`Track ${index + 1} description`}
                  value={track.description}
                  onChange={(e) => setTracks((prev) => prev.map((t, i) => (i === index ? { ...t, description: e.target.value } : t)))}
                  maxLength={500}
                  className={`${inputClass} mt-2`}
                  placeholder="Short description (optional)"
                />
              </div>
            ))}
          </div>
        </Section>

        <Section
          step={4}
         
          title="Prizes"
          description="Shown on the public event page, optionally tied to a track."
          action={<Button type="button" variant="secondary" size="sm" onClick={() => setPrizes((prev) => [...prev, { name: "", amount: "", rank: prev.length + 1, trackIndex: "" }])}>+ Add prize</Button>}
        >
          {prizes.length === 0 ? <p className="text-sm text-zinc-500">No prizes yet.</p> : null}
          <div className="space-y-4">
            {prizes.map((prize, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-line bg-zinc-50/70 p-4 sm:grid-cols-[1fr_140px_90px_1fr_auto] sm:items-end">
                <Field label="Prize" htmlFor={`pz-name-${index}`}>
                  <input id={`pz-name-${index}`} value={prize.name} onChange={(e) => setPrizes((prev) => prev.map((p, i) => (i === index ? { ...p, name: e.target.value } : p)))} className={inputClass} placeholder="Grand prize" />
                </Field>
                <Field label="Amount" htmlFor={`pz-amount-${index}`}>
                  <input id={`pz-amount-${index}`} value={prize.amount} onChange={(e) => setPrizes((prev) => prev.map((p, i) => (i === index ? { ...p, amount: e.target.value } : p)))} className={inputClass} placeholder="$1,000" />
                </Field>
                <Field label="Rank" htmlFor={`pz-rank-${index}`}>
                  <input id={`pz-rank-${index}`} type="number" min={1} value={prize.rank} onChange={(e) => setPrizes((prev) => prev.map((p, i) => (i === index ? { ...p, rank: Number(e.target.value) } : p)))} className={inputClass} />
                </Field>
                <Field label="Track" htmlFor={`pz-track-${index}`}>
                  <select
                    id={`pz-track-${index}`}
                    value={prize.trackIndex === "" ? "" : String(prize.trackIndex)}
                    onChange={(e) => setPrizes((prev) => prev.map((p, i) => (i === index ? { ...p, trackIndex: e.target.value === "" ? "" : Number(e.target.value) } : p)))}
                    className={inputClass}
                  >
                    <option value="">Overall</option>
                    {tracks.map((t, i) => (
                      <option key={i} value={i}>{t.name || `Track ${i + 1}`}</option>
                    ))}
                  </select>
                </Field>
                <IconButton label="Remove prize" onClick={() => setPrizes((prev) => prev.filter((_, i) => i !== index))} danger>✕</IconButton>
              </div>
            ))}
          </div>
        </Section>

        <Section
          step={5}
         
          title="Submission questions"
          description="Extra fields on the submission form. Answers are visible to the team, organizers and judges only."
          action={<Button type="button" variant="secondary" size="sm" onClick={() => setQuestions((prev) => [...prev, { label: "", type: "text", required: false, options: "" }])}>+ Add question</Button>}
        >
          {questions.length === 0 ? <p className="text-sm text-zinc-500">No custom questions.</p> : null}
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.id ?? `q-${index}`} className="rounded-xl border border-line bg-zinc-50/70 p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_150px_auto] sm:items-end">
                  <Field label="Question" htmlFor={`q-label-${index}`}>
                    <input id={`q-label-${index}`} value={question.label} onChange={(e) => setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, label: e.target.value } : q)))} maxLength={300} className={inputClass} placeholder="What did you build during the event?" />
                  </Field>
                  <Field label="Answer type" htmlFor={`q-type-${index}`}>
                    <select id={`q-type-${index}`} value={question.type} onChange={(e) => setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, type: e.target.value as QuestionType } : q)))} className={inputClass}>
                      <option value="text">Short text</option>
                      <option value="textarea">Long text</option>
                      <option value="url">URL</option>
                      <option value="select">Choice</option>
                    </select>
                  </Field>
                  <IconButton label="Remove question" onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== index))} danger>✕</IconButton>
                </div>
                {question.type === "select" ? (
                  <Field label="Options (one per line)" htmlFor={`q-opts-${index}`} className="mt-3">
                    <textarea id={`q-opts-${index}`} rows={3} value={question.options} onChange={(e) => setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, options: e.target.value } : q)))} className={inputClass} placeholder={"Web\nMobile"} />
                  </Field>
                ) : null}
                <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
                  <input className="h-4 w-4 accent-ink" type="checkbox" checked={question.required} onChange={(e) => setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, required: e.target.checked } : q)))} />
                  Required to submit (drafts can leave it empty)
                </label>
              </div>
            ))}
          </div>
        </Section>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="flex flex-wrap items-center gap-3 lg:hidden">
          <Button type="submit" disabled={saving} size="lg">{submitLabel}</Button>
          <ButtonLink href="/organizer/dashboard" variant="secondary" size="lg">Cancel</ButtonLink>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="relative overflow-hidden rounded-2xl bg-ink p-5 text-white">
          <div aria-hidden className="graph-paper-dark absolute inset-0" />
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] tracking-[0.14em] text-white/50 uppercase">Poster preview</p>
              {dates.submissions_close ? (
                <Countdown to={fromLocalInput(dates.submissions_close)} tone="dark" />
              ) : null}
            </div>
            <h3 className="font-display mt-4 text-xl leading-snug font-semibold break-words">
              {name.trim() || "Untitled event"}
            </h3>
            {shortDescription.trim() ? (
              <p className="mt-2 line-clamp-2 text-sm text-white/65">{shortDescription}</p>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5">
          <dl className="space-y-3 text-sm">
            <PreviewRow label="Visibility" value={published ? "Published" : "Hidden"} />
            <PreviewRow label="Registration" value={dates.registration_opens ? formatDateTime(fromLocalInput(dates.registration_opens)) : "Open now"} />
            <PreviewRow label="Deadline" value={formatDateTime(fromLocalInput(dates.submissions_close))} />
            <PreviewRow label="Tracks" value={String(tracks.filter((t) => t.name.trim()).length)} />
            <PreviewRow label="Prizes" value={String(prizes.filter((p) => p.name.trim() && p.amount.trim()).length)} />
            <PreviewRow label="Questions" value={String(questions.filter((q) => q.label.trim()).length)} />
            <PreviewRow label="Team size" value={`1–${maxTeamSize}`} />
          </dl>
        </div>
        <div className="hidden rounded-2xl border border-line bg-white p-5 lg:block">
          <p className="text-sm text-zinc-500">
            {mode === "edit" ? "Changes apply immediately, including deadline changes." : "You can edit everything after creating the event."}
          </p>
          <Button type="submit" disabled={saving} className="mt-5 w-full">{submitLabel}</Button>
          <ButtonLink href="/organizer/dashboard" variant="ghost" className="mt-2 w-full">
            Cancel
          </ButtonLink>
        </div>
      </aside>
    </form>
  );
}

function Section({
  step,
  title,
  description,
  action,
  children,
}: {
  step: number;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-col gap-4 border-b border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink text-sm font-semibold text-signal-300">{step}</span>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
            <p className="text-sm text-zinc-500">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="field-label">{label}</label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition disabled:opacity-30 ${
        danger ? "text-zinc-500 hover:bg-red-50 hover:text-red-600" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      }`}
    >
      {children}
    </button>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="font-mono text-[11px] tracking-[0.12em] text-zinc-500 uppercase">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}
