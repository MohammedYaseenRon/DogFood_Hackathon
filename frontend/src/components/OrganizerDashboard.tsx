"use client";

import { useEffect, useState } from "react";
import { fetchOrganizerStatsClient, type OrganizerStats } from "@/lib/api";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Stat } from "@/components/ui/Stat";

export function OrganizerDashboard() {
  const [stats, setStats] = useState<OrganizerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganizerStatsClient().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  if (!stats) {
    return (
      <EmptyState
        title="Organizer access required"
        description="Log in as the organizer to view judging progress and export results."
        action={
          <ButtonLink href="/login" variant="primary">
            Sign in as organizer
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/api/export.csv" size="lg">
          Download CSV export
        </ButtonLink>
        <ButtonLink href="/event" variant="secondary" size="lg">
          View event
        </ButtonLink>
        <ButtonLink href="/organizer/event/edit" variant="secondary" size="lg">
          Manage event
        </ButtonLink>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Projects" value={stats.totalProjects} />
        <Stat label="Judges" value={stats.totalJudges} />
        <Stat label="Scores submitted" value={stats.totalScores} variant="gradient" />
        <Stat
          label="Completion"
          value={`${stats.completionPercent}%`}
          hint={`${stats.totalScores} / ${stats.totalAssignments} assignments`}
        />
      </div>

      <Card variant="elevated" className="overflow-hidden p-0">
        <div className="border-b border-zinc-100 bg-zinc-50/50 px-6 py-5">
          <h2 className="font-display text-lg font-bold text-zinc-900">
            Judge progress
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Live tracking of scoring completion across all judges
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Judge</th>
                <th className="px-6 py-3 font-semibold">Completed</th>
                <th className="px-6 py-3 font-semibold">Assigned</th>
                <th className="px-6 py-3 font-semibold">Progress</th>
              </tr>
            </thead>
            <tbody>
              {stats.judgeProgress.map((judge) => (
                <tr
                  key={judge.id}
                  className="border-t border-zinc-100 transition hover:bg-zinc-50/50"
                >
                  <td className="px-6 py-4 font-medium text-zinc-900">
                    {judge.name}
                  </td>
                  <td className="px-6 py-4 text-zinc-600">{judge.completed}</td>
                  <td className="px-6 py-4 text-zinc-600">{judge.assigned}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2.5 w-28 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 transition-all"
                          style={{ width: `${judge.percent}%` }}
                        />
                      </div>
                      <span className="font-semibold text-violet-600">
                        {judge.percent}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Alert tone="info">
        CSV export includes all scores with functionality, quality, and innovation
        columns for every judge-project pair in the fixture data.
      </Alert>
    </div>
  );
}
