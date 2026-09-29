"use client";

import { useState } from "react";
import { importEventClient, type ImportSummary } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeaderBand } from "@/components/ui/PageShell";

const COUNTS: { key: keyof ImportSummary; label: string }[] = [
  { key: "tracks", label: "Tracks" },
  { key: "rubric", label: "Rubric criteria" },
  { key: "judges", label: "Judges" },
  { key: "teams", label: "Teams" },
  { key: "projects", label: "Projects" },
  { key: "assignments", label: "Assignments" },
  { key: "scores", label: "Scores" },
];

type Stage =
  | { step: "pick" }
  | { step: "checking" }
  | { step: "preview"; summary: ImportSummary }
  | { step: "importing"; summary: ImportSummary }
  | { step: "done"; summary: ImportSummary; event: { slug: string; name: string } }
  | { step: "refused"; problems: string[] };

export function EventImport() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ step: "pick" });

  async function choose(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const body = await file.text();
    setText(body);
    setStage({ step: "checking" });
    const result = await importEventClient(body, true);
    setStage(result.ok ? { step: "preview", summary: result.summary } : { step: "refused", problems: result.problems });
  }

  async function confirm() {
    if (!text || stage.step !== "preview") return;
    setStage({ step: "importing", summary: stage.summary });
    const result = await importEventClient(text, false);
    if (result.ok && result.event) setStage({ step: "done", summary: result.summary, event: result.event });
    else setStage({ step: "refused", problems: result.ok ? ["Import failed."] : result.problems });
  }

  const summary = "summary" in stage ? stage.summary : null;

  return (
    <main className="pb-24">
      <PageHeaderBand
        eyebrow="Organizer / import"
        title="Import an event"
        mark="event"
        description="Bring a whole event in from one JSON file: the official fixtures.json, or an export from any Hackboard portal. You see what it will create before anything is saved."
        action={
          <ButtonLink href="/organizer/dashboard" variant="ghost" size="sm">
            Organizer dashboard
          </ButtonLink>
        }
      />
      <div className="mx-auto max-w-3xl space-y-6 px-5 sm:px-6">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white px-6 py-10 text-center transition hover:border-zinc-400">
          <span className="font-display text-lg font-semibold text-ink">
            {fileName ?? "Choose an event file"}
          </span>
          <span className="text-sm text-zinc-500">
            .json in the fixtures.json shape · up to 20 MB
          </span>
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </label>

        {stage.step === "checking" ? <p className="text-sm text-zinc-500">Checking the file…</p> : null}

        {stage.step === "refused" ? (
          <Alert tone="error" title="This file can't be imported. Nothing was saved.">
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {stage.problems.slice(0, 25).map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
            {stage.problems.length > 25 ? <p className="mt-1">…and {stage.problems.length - 25} more.</p> : null}
          </Alert>
        ) : null}

        {summary ? (
          <section className="rounded-2xl border border-line bg-white p-6">
            <p className="text-sm text-zinc-500">
              {stage.step === "done" ? "Imported" : "Will create or update"}
            </p>
            <h2 className="font-display mt-1 text-xl font-semibold text-ink">{summary.event}</h2>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {COUNTS.map(({ key, label }) => (
                <div key={key} className="rounded-xl bg-canvas px-3 py-2.5">
                  <dt className="text-xs text-zinc-500">{label}</dt>
                  <dd className="font-mono text-lg font-semibold text-ink">{summary[key]}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-zinc-500">
              Rows are matched by their ids, so importing the same file again updates the event instead of copying it.
              People are matched by email and never lose a role they already have.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {stage.step === "preview" || stage.step === "importing" ? (
                <Button onClick={confirm} disabled={stage.step === "importing"}>
                  {stage.step === "importing" ? "Importing…" : "Import event"}
                </Button>
              ) : null}
              {stage.step === "done" ? (
                <>
                  <ButtonLink href={`/organizer/events/${stage.event.slug}`}>Open {stage.event.name}</ButtonLink>
                  <ButtonLink href={`/organizer/events/${stage.event.slug}/judging`} variant="secondary">
                    Judging console
                  </ButtonLink>
                </>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
