const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

export type ProjectSummary = {
  id: string;
  title: string;
  tagline?: string | null;
  summary: string;
  trackName: string;
  teamName: string;
  repoUrl: string;
  demoUrl?: string | null;
  liveUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  techTags?: string[];
};

export type ProjectDetail = ProjectSummary & {
  teamId?: string;
  members?: Array<{ name: string; email: string; role: string }>;
};

export type PrizeInfo = {
  id: string;
  name: string;
  amount: string;
  rank: number;
  trackId: string | null;
  trackName: string | null;
};

export type EventPhase =
  | "DRAFT"
  | "UPCOMING"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "LIVE"
  | "SUBMISSION_OPEN"
  | "SUBMISSIONS_CLOSED"
  | "JUDGING"
  | "COMPLETED";

export type EventState = {
  phase: EventPhase;
  registrationOpen: boolean;
  submissionsOpen: boolean;
  submissionsClose?: string;
};

export type EventInfo = {
  id: string;
  slug?: string;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  submissionsClose: string;
  registrationOpens?: string | null;
  registrationCloses?: string | null;
  maxTeamSize?: number;
  state?: EventState;
  tracks: Array<{ id: string; name: string; description?: string | null }>;
  prizes: PrizeInfo[];
  rubric: Array<{ name: string; weight: number }>;
};

export type MyProject = {
  id: string;
  title: string;
  tagline?: string | null;
  summary: string;
  trackName: string;
  trackId: string;
  teamName: string;
  repoUrl: string;
  demoUrl?: string | null;
  liveUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  techTags?: string[];
  status: "DRAFT" | "SUBMITTED";
  submittedAt: string | null;
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

export type OrganizerJudgeProgress = {
  id: string;
  name: string;
  email?: string;
  assigned: number;
  completed: number;
  remaining?: number;
  percent: number;
};

export type OrganizerStats = {
  totalProjects: number;
  totalJudges: number;
  totalAssignments: number;
  totalScores: number;
  remainingAssignments?: number;
  completionPercent: number;
  judgesComplete?: number;
  judgesBehind?: number;
  averageJudgePercent?: number;
  event?: {
    name: string;
    submissionsClose: string;
    submissionsOpen: boolean;
  } | null;
  judgeProgress: OrganizerJudgeProgress[];
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

async function clientJson<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<{ data: T | null; error: string | null }> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

async function clientPost<T>(
  path: string,
  body: unknown,
): Promise<{ data: T | null; error: string | null }> {
  return clientJson(path, "POST", body);
}

async function clientPatch<T>(
  path: string,
  body: unknown,
): Promise<{ data: T | null; error: string | null }> {
  return clientJson(path, "PATCH", body);
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

export async function fetchEvents(): Promise<EventInfo[]> {
  const data = await serverFetch("/api/events");
  return data?.events ?? [];
}

export async function fetchEventBySlug(slug: string): Promise<EventInfo | null> {
  const data = await serverFetch(`/api/events/${slug}`);
  return data?.event ?? null;
}

export async function fetchProjectDetail(
  projectId: string,
): Promise<ProjectDetail | null> {
  const data = await serverFetch(`/api/projects/${projectId}`);
  return data?.project ?? null;
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

export type TeamSummary = {
  id: string;
  fixtureId?: string;
  name: string;
  eventId?: string;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  memberCount?: number;
  myRole?: string | null;
  teamUrl?: string;
  inviteUrl?: string;
};

export type TeamMemberInfo = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string;
};

export type TeamInviteInfo = {
  id: string;
  token: string;
  teamId: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  revoked: boolean;
  createdAt: string;
  inviteUrl: string;
  remainingUses: number;
  expired: boolean;
};

export type InvitePreview = {
  token: string;
  type: "invite" | "legacy";
  team: {
    id: string;
    name: string;
    memberCount: number;
  };
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number | null;
  remainingUses: number | null;
  members: TeamMemberInfo[];
};

export async function fetchMyTeamClient(): Promise<{ team: TeamSummary | null } | null> {
  return clientFetch("/api/teams/mine");
}

export async function fetchTeamClient(teamId: string): Promise<{ team: TeamSummary } | null> {
  return clientFetch(`/api/teams/${teamId}`);
}

export async function fetchTeamMembersClient(
  teamId: string,
): Promise<{ members: TeamMemberInfo[] } | null> {
  return clientFetch(`/api/teams/${teamId}/members`);
}

export async function fetchInvitePreview(token: string): Promise<InvitePreview | null> {
  const res = await fetch(`${backendUrl}/api/invites/${token}`, { next: { revalidate: 0 } });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchInvitePreviewClient(
  token: string,
): Promise<{ data: InvitePreview | null; error: string | null; status: number }> {
  const res = await fetch(`/api/invites/${token}`, { credentials: "include" });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : "Invitation unavailable";
    return { data: null, error: detail, status: res.status };
  }
  return { data, error: null, status: res.status };
}

export async function createTeamInviteClient(
  teamId: string,
  payload?: { expires_in_hours?: number; max_uses?: number },
): Promise<{ invite: TeamInviteInfo | null; error: string | null }> {
  const result = await clientPost<{ invite: TeamInviteInfo }>(
    `/api/teams/${teamId}/invites`,
    payload ?? {},
  );
  return { invite: result.data?.invite ?? null, error: result.error };
}

export async function joinTeamInviteClient(
  token: string,
): Promise<{
  teamId: string | null;
  teamName: string | null;
  alreadyMember: boolean;
  message: string | null;
  error: string | null;
}> {
  const result = await clientPost<{
    ok: boolean;
    teamId: string;
    teamName: string;
    alreadyMember: boolean;
    message: string;
  }>(`/api/invites/${token}/join`, {});
  if (result.error) {
    return {
      teamId: null,
      teamName: null,
      alreadyMember: false,
      message: null,
      error: result.error,
    };
  }
  return {
    teamId: result.data?.teamId ?? null,
    teamName: result.data?.teamName ?? null,
    alreadyMember: result.data?.alreadyMember ?? false,
    message: result.data?.message ?? null,
    error: null,
  };
}

export async function revokeTeamInviteClient(
  token: string,
): Promise<{ ok: boolean; error: string | null }> {
  const res = await fetch(`/api/invites/${token}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data?.detail === "string" ? data.detail : "Could not revoke invite",
    };
  }
  return { ok: true, error: null };
}

export async function fetchMyProjectClient(): Promise<{ project: MyProject | null } | null> {
  return clientFetch("/api/projects/mine");
}

export async function createTeamClient(
  name: string,
): Promise<{ team: TeamSummary | null; error: string | null }> {
  const result = await clientPost<{ team: TeamSummary }>("/api/teams", { name });
  return { team: result.data?.team ?? null, error: result.error };
}

export async function fetchMyRegistrationClient(): Promise<{
  registered: boolean;
  registration: { registeredAt: string } | null;
} | null> {
  return clientFetch("/api/events/registration/mine");
}

export async function registerForEventClient(): Promise<{
  ok: boolean;
  alreadyRegistered: boolean;
  error: string | null;
}> {
  const result = await clientPost<{
    ok: boolean;
    alreadyRegistered: boolean;
  }>("/api/events/register", {});
  return {
    ok: Boolean(result.data?.ok),
    alreadyRegistered: Boolean(result.data?.alreadyRegistered),
    error: result.error,
  };
}

export type AdminStats = {
  users: number;
  events: number;
  projects: number;
  participants: number;
  judges: number;
  organizers: number;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  suspended: boolean;
  createdAt: string;
};

export async function fetchAdminStatsClient(): Promise<AdminStats | null> {
  return clientFetch("/api/admin/stats");
}

export async function fetchAdminUsersClient(): Promise<AdminUser[]> {
  const data = await clientFetch("/api/admin/users");
  return data?.users ?? [];
}

export async function suspendUserClient(
  userId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const res = await fetch(`/api/admin/users/${userId}/suspend`, {
    method: "PATCH",
    credentials: "include",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data?.detail === "string" ? data.detail : "Request failed",
    };
  }
  return { ok: true, error: null };
}

export async function saveProjectClient(
  payload: {
    title: string;
    tagline?: string;
    summary: string;
    repo_url: string;
    demo_url?: string;
    live_url?: string;
    video_url?: string;
    thumbnail_url?: string;
    tech_tags?: string[];
    track_id: string;
    status: "DRAFT" | "SUBMITTED";
  },
  existingId?: string,
): Promise<{ project: MyProject | null; error: string | null }> {
  if (existingId) {
    const result = await clientPatch<MyProject>(`/api/projects/${existingId}`, payload);
    return { project: result.data, error: result.error };
  }
  const result = await clientPost<MyProject>("/projects/new", payload);
  return { project: result.data, error: result.error };
}

export type EventPayload = {
  name: string;
  submissions_close: string;
  tracks: Array<{ id?: string; name: string }>;
  prizes: Array<{ name: string; amount: string; rank: number; track_index?: number }>;
};

export async function createEventClient(
  payload: EventPayload,
): Promise<{ event: EventInfo | null; error: string | null }> {
  const result = await clientPost<{ event: EventInfo }>("/api/events", payload);
  return { event: result.data?.event ?? null, error: result.error };
}

export async function updateEventClient(
  payload: EventPayload,
): Promise<{ event: EventInfo | null; error: string | null }> {
  const result = await clientPatch<{ event: EventInfo }>("/api/events", payload);
  return { event: result.data?.event ?? null, error: result.error };
}

export { backendUrl };
