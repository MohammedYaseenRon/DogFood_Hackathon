const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

export type ProjectSummary = {
  id: string;
  title: string;
  summary: string;
  trackName: string;
  teamName: string;
  repoUrl: string;
};

export type EventInfo = {
  id: string;
  name: string;
  submissionsClose: string;
  tracks: Array<{ id: string; name: string }>;
  rubric: Array<{ name: string; weight: number }>;
};

export type UserInfo = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  fixtureId: string | null;
};

export type PublicStats = {
  projectCount: number;
  trackCount: number;
  judgeCount: number;
  eventName: string;
  submissionsClose: string | null;
  submissionsOpen: boolean;
};

export type RubricCriterion = {
  name: string;
  weight: number;
};

export type JudgeAssignment = {
  projectId: string;
  title: string;
  summary: string;
  trackName: string;
  scored: boolean;
  criteria?: Record<string, number>;
  comment?: string;
  weightedTotal?: number;
};

export type JudgeScore = {
  projectId: string;
  title: string;
  criteria: Record<string, number>;
  comment: string;
  weightedTotal?: number;
};

export type ScoreSubmitPayload = {
  project_id: string;
  criteria: Record<string, number>;
  comment?: string;
};

export type OrganizerStats = {
  totalProjects: number;
  totalJudges: number;
  totalAssignments: number;
  totalScores: number;
  completionPercent: number;
  judgeProgress: Array<{
    id: string;
    name: string;
    assigned: number;
    completed: number;
    percent: number;
  }>;
};

async function serverFetch(path: string) {
  const res = await fetch(`${backendUrl}${path}`, { next: { revalidate: 0 } });
  if (!res.ok) return null;
  return res.json();
}

async function clientFetch(path: string) {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

async function clientPost<T>(
  path: string,
  body: unknown,
): Promise<{ data: T | null; error: string | null }> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : `Request failed (${res.status})`;
    return { data: null, error: detail };
  }
  return { data, error: null };
}

export async function fetchProjects(params?: {
  q?: string;
  track?: string;
}): Promise<ProjectSummary[]> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.track) search.set("track", params.track);
  const query = search.toString();
  const data = await serverFetch(`/api/projects${query ? `?${query}` : ""}`);
  return data ?? [];
}

export async function fetchEvent(): Promise<EventInfo | null> {
  const data = await serverFetch("/api/event");
  return data?.event ?? null;
}

export async function fetchPublicStats(): Promise<PublicStats | null> {
  return serverFetch("/api/stats/public");
}

export async function fetchMeClient(): Promise<UserInfo | null> {
  return clientFetch("/api/auth/me");
}

export async function fetchJudgeAssignmentsClient(): Promise<JudgeAssignment[]> {
  const data = await clientFetch("/api/judge/assignments");
  return data ?? [];
}

export async function fetchJudgeScoresClient(): Promise<JudgeScore[]> {
  const data = await clientFetch("/api/judge/scores");
  return data ?? [];
}

export async function fetchJudgeRubricClient(): Promise<RubricCriterion[]> {
  const data = await clientFetch("/api/judge/rubric");
  return data ?? [];
}

export async function submitJudgeScoreClient(
  payload: ScoreSubmitPayload,
): Promise<{ score: JudgeScore | null; error: string | null }> {
  const result = await clientPost<JudgeScore>("/api/judge/scores", payload);
  return { score: result.data, error: result.error };
}

export async function fetchOrganizerStatsClient(): Promise<OrganizerStats | null> {
  return clientFetch("/api/organizer/stats");
}

export async function fetchMyTeamClient(): Promise<{
  team: { name: string; inviteToken: string; inviteUrl: string } | null;
} | null> {
  return clientFetch("/api/teams/mine");
}

export { backendUrl };
