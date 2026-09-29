"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJudgingOverviewClient, type JudgingOverview } from "@/lib/api";
import { phaseInfo } from "@/lib/format";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeaderBand } from "@/components/ui/PageShell";
import { AssignmentsTab } from "@/components/judging/AssignmentsTab";
import { PanelTab } from "@/components/judging/PanelTab";
import { ProgressTab } from "@/components/judging/ProgressTab";
import { ResultsTab } from "@/components/judging/ResultsTab";
import { RubricTab } from "@/components/judging/RubricTab";
import { Spinner } from "@/components/judging/shared";

const TABS = [
  { id: "progress", label: "Progress" },
  { id: "panel", label: "Judges" },
  { id: "assignments", label: "Assignments" },
  { id: "rubric", label: "Rubric" },
  { id: "results", label: "Results & exports" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function JudgingConsole({ slug }: { slug: string }) {
  const [overview, setOverview] = useState<JudgingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("progress");
  // Bumped after edits so tabs that depend on the panel reload.
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => {
    fetchJudgingOverviewClient(slug).then((res) => {
      if (res.data) setOverview(res.data);
      setVersion((v) => v + 1);
    });
  }, [slug]);

  useEffect(() => {
    let active = true;
    fetchJudgingOverviewClient(slug).then((res) => {
      if (!active) return;
      if (res.data) setOverview(res.data);
      else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <EmptyState
          title="Event not found"
          description={error}
          action={<ButtonLink href="/organizer/dashboard">Organizer dashboard</ButtonLink>}
        />
      </main>
    );
  }
  if (!overview) return <Spinner />;

  const phase = phaseInfo(overview.event.phase);

  return (
    <main className="pb-24">
      <PageHeaderBand
        eyebrow={`Organizer / ${overview.event.name}`}
        title="Judging console"
        mark="console"
        description="Invite judges, hand out projects, tune the rubric and read normalized results."
        badge={
          <>
            <Badge tone={phase.tone}>{phase.label}</Badge>
            <Badge tone={overview.scoringOpen ? "success" : "default"}>
              {overview.scoringOpen ? "Scoring open" : "Scoring closed"}
            </Badge>
          </>
        }
        action={
          <>
            <ButtonLink href={`/organizer/events/${slug}`} variant="secondary" size="sm">
              Event overview
            </ButtonLink>
            <ButtonLink href={`/organizer/events/${slug}/edit`} variant="ghost" size="sm">
              Edit dates
            </ButtonLink>
          </>
        }
        extra={
          <div role="tablist" aria-label="Judging sections" className="flex gap-1 overflow-x-auto border-b border-line">
            {TABS.map((item) => (
              <button
                key={item.id}
                role="tab"
                type="button"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                  tab === item.id ? "border-ink text-ink" : "border-transparent text-zinc-500 hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />
      <div className="mx-auto max-w-7xl space-y-6 px-5 sm:px-6">
        {!overview.scoringOpen && overview.scoringBlockReason ? (
          <Alert tone="info" title="Judges can't score yet">
            {overview.scoringBlockReason} You can still build the panel and hand out assignments.
          </Alert>
        ) : null}
        <div role="tabpanel">
          {tab === "progress" ? <ProgressTab key={version} slug={slug} initial={overview.progress} /> : null}
          {tab === "panel" ? <PanelTab slug={slug} tracks={overview.tracks} onChange={reload} /> : null}
          {tab === "assignments" ? (
            <AssignmentsTab key={version} slug={slug} judges={overview.progress.judges} onChange={reload} />
          ) : null}
          {tab === "rubric" ? (
            <RubricTab
              key={`${version}-${overview.rubricLocked}`}
              slug={slug}
              initial={overview.rubric}
              locked={overview.rubricLocked}
              onSaved={reload}
            />
          ) : null}
          {tab === "results" ? <ResultsTab key={version} slug={slug} /> : null}
        </div>
      </div>
    </main>
  );
}
