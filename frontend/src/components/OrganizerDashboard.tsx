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
    return <p className="text-slate-500">Loading organizer dashboard...</p>;
  }

  if (!stats) {
    return (
      <EmptyState
        title="Organizer access required"
        description="Log in as the organizer to view judging progress and export results."
        action={
          <ButtonLink href="/login" variant="primary">
            Go to login
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/api/export.csv" variant="primary">
          Download CSV export
        </ButtonLink>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Projects" value={stats.totalProjects} />
        <Stat label="Judges" value={stats.totalJudges} />
        <Stat label="Scores submitted" value={stats.totalScores} />
        <Stat
          label="Completion"
          value={`${stats.completionPercent}%`}
          hint={`${stats.totalScores} / ${stats.totalAssignments} assignments`}
        />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Judge progress</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Judge</th>
                <th className="px-6 py-3 font-medium">Completed</th>
                <th className="px-6 py-3 font-medium">Assigned</th>
                <th className="px-6 py-3 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {stats.judgeProgress.map((judge) => (
                <tr key={judge.id} className="border-t border-slate-100">
                  <td className="px-6 py-3 font-medium text-slate-900">
                    {judge.name}
                  </td>
                  <td className="px-6 py-3">{judge.completed}</td>
                  <td className="px-6 py-3">{judge.assigned}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-indigo-600"
                          style={{ width: `${judge.percent}%` }}
                        />
                      </div>
                      <span className="text-slate-500">{judge.percent}%</span>
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
