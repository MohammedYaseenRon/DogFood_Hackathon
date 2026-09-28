/**
 * Shared API types and browser-side calls. Browser requests go to same-origin
 * `/api/*`, which next.config.ts rewrites to the FastAPI backend, so the
 * session cookie travels with them. Server components use `server-api.ts`.
 */

export const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  teamFormationOpen: boolean;
  submissionsOpen: boolean;
  submissionsClose?: string;
  serverTime?: string;
};

/** Compact event reference embedded in teams, projects and dashboards. */
export type EventRef = {
  id: string;
  slug: string;
  name: string;
  submissionsClose: string;
  submissionsOpen: boolean;
  teamFormationOpen: boolean;
  phase: EventPhase;
};

export type PrizeInfo = {
  id: string;
  name: string;
  amount: string;
  rank: number;
  trackId: string | null;
  trackName: string | null;
};

export type QuestionType = "text" | "textarea" | "url" | "select";

export type CustomQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
};

export type EventCounts = {
  registrations: number;
  teams: number;
  submitted: number;
  drafts: number;
};

export type EventInfo = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  published: boolean;
  registrationOpens?: string | null;
  registrationCloses?: string | null;
  eventStarts?: string | null;
  eventEnds?: string | null;
  submissionsClose: string;
  judgingStarts?: string | null;
  judgingEnds?: string | null;
  resultsAt?: string | null;
  maxTeamSize: number;
  state: EventState;
  tracks: Array<{ id: string; name: string; description?: string | null }>;
  prizes: PrizeInfo[];
  rubric: Array<{ name: string; weight: number }>;
  questions: CustomQuestion[];
  counts?: EventCounts;
};

export type ProjectStatus = "DRAFT" | "SUBMITTED";

export type ProjectSummary = {
  id: string;
  title: string;
  tagline?: string | null;
  summary: string;
  trackName: string | null;
  trackId: string | null;
  teamName: string;
  memberCount: number;
  repoUrl?: string | null;
  demoUrl?: string | null;
  liveUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  imageUrls: string[];
  techTags: string[];
  status: ProjectStatus;
  submittedAt: string | null;
  updatedAt?: string | null;
  event: EventRef | null;
};

export type ProjectDetail = ProjectSummary & {
  teamId: string;
  members: Array<{ name: string; role: string; email?: string }>;
  canEdit?: boolean;
  answers?: Record<string, string>;
  questions?: Array<CustomQuestion & { answer: string | null }>;
};

export type GalleryFacets = {
  total: number;
  tracks: Array<{ id: string; name: string; count: number }>;
  tags: Array<{ name: string; count: number }>;
};

export type UserRole = "VISITOR" | "PARTICIPANT" | "JUDGE" | "ORGANIZER" | "ADMIN";

export type UserInfo = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  fixtureId: string | null;
};

export type PublicStats = {
  projectCount: number;
  eventCount: number;
  trackCount: number;
  judgeCount: number;
  eventName: string;
  eventSlug: string | null;
  submissionsClose: string | null;
  submissionsOpen: boolean;
};

export type TeamSummary = {
  id: string;
  fixtureId?: string;
  name: string;
  description?: string | null;
  eventId?: string;
  event: EventRef | null;
  maxTeamSize: number;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  memberCount: number;
  myRole?: "OWNER" | "ADMIN" | "MEMBER" | null;
  teamUrl?: string;
  project?: { id: string; title: string; status: ProjectStatus } | null;
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
  team: { id: string; name: string; memberCount: number; maxTeamSize: number };
  event: EventRef | null;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number | null;
  remainingUses: number | null;
  members: TeamMemberInfo[];
};

export type ParticipantEntry = {
  event: EventRef;
  registered: boolean;
  registeredAt: string | null;
  team: {
    id: string;
    name: string;
    myRole: "OWNER" | "ADMIN" | "MEMBER";
    memberCount: number;
    maxTeamSize: number;
  } | null;
  project: {
    id: string;
    title: string;
    tagline: string | null;
    status: ProjectStatus;
    submittedAt: string | null;
    updatedAt: string | null;
  } | null;
};

export type RubricCriterion = { name: string; weight: number };

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
  event?: (EventRef & { counts: EventCounts }) | null;
  judgeProgress: OrganizerJudgeProgress[];
};

export type OrganizerEvent = EventRef & { published: boolean; counts: EventCounts };

export type EventSubmissions = {
  event: EventRef;
  counts: EventCounts;
  teams: Array<{
    teamId: string;
    teamName: string;
    members: Array<{ name: string; email: string; role: string }>;
    project: {
      id: string;
      title: string;
      status: ProjectStatus;
      trackName: string | null;
      submittedAt: string | null;
      updatedAt: string | null;
    } | null;
  }>;
};

export type AdminStats = {
  users: number;
  events: number;
  projects: number;
  submitted: number;
  drafts: number;
  visitors: number;
  participants: number;
  judges: number;
  organizers: number;
  admins: number;
  suspended: number;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  suspended: boolean;
  hasPassword: boolean;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: string;
  createdAt: string;
};

export type ProjectPayload = {
  event?: string;
  title?: string;
  tagline?: string;
  summary?: string;
  repo_url?: string;
  demo_url?: string;
  live_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  image_urls?: string[];
  tech_tags?: string[];
  track_id?: string;
  status?: ProjectStatus;
  answers?: Record<string, string>;
};

export type EventPayload = {
  name: string;
  slug?: string;
  short_description?: string;
  description?: string;
  published: boolean;
  max_team_size: number;
  registration_opens?: string | null;
  registration_closes?: string | null;
  event_starts?: string | null;
  event_ends?: string | null;
  submissions_close: string;
  judging_starts?: string | null;
  judging_ends?: string | null;
  results_at?: string | null;
  tracks: Array<{ id?: string; name: string; description?: string }>;
  prizes: Array<{ name: string; amount: string; rank: number; track_index?: number }>;
  questions: Array<{
    id?: string;
    label: string;
    type: QuestionType;
    required: boolean;
    options: string[];
  }>;
};

export type Result<T> = { data: T | null; error: string | null; status: number };

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

function errorDetail(data: unknown, status: number): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) {
    const first = detail[0] as { msg: string; loc?: unknown[] };
    const field = first.loc?.filter((part) => part !== "body").join(".");
    return field ? `${field}: ${first.msg}` : first.msg;
  }
  if (status === 401) return "Please sign in to continue.";
  if (status === 403) return "You don't have permission to do that.";
  return `Request failed (${status})`;
}

export async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Result<T>> {
  try {
    const res = await fetch(path, {
      method: init.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { data: null, error: errorDetail(data, res.status), status: res.status };
    return { data: data as T, error: null, status: res.status };
  } catch {
    return { data: null, error: "Network error — is the server running?", status: 0 };
  }
}

async function getOrNull<T>(path: string): Promise<T | null> {
  return (await request<T>(path)).data;
}

function qs(params: Record<string, string | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export function fetchMeClient(): Promise<UserInfo | null> {
  return getOrNull<UserInfo>("/api/auth/me");
}

export function updateProfileClient(name: string) {
  return request<UserInfo>("/api/auth/me", { method: "PATCH", body: { name } });
}

export function changePasswordClient(currentPassword: string | null, newPassword: string) {
  return request<{ ok: boolean }>("/api/auth/password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

export function logoutClient() {
  return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function fetchEventsClient(scope?: "all"): Promise<EventInfo[]> {
  const data = await getOrNull<{ events: EventInfo[] }>(`/api/events${qs({ scope })}`);
  return data?.events ?? [];
}

export async function fetchEventClient(slug: string): Promise<EventInfo | null> {
  const data = await getOrNull<{ event: EventInfo }>(`/api/events/${encodeURIComponent(slug)}`);
  return data?.event ?? null;
}

export async function fetchMyRegistrationClient(event?: string) {
  return getOrNull<{ registered: boolean; registration: { registeredAt: string } | null }>(
    `/api/events/registration/mine${qs({ event })}`,
  );
}

export async function registerForEventClient(event: string) {
  const result = await request<{ ok: boolean; alreadyRegistered: boolean }>(
    `/api/events/${encodeURIComponent(event)}/register`,
    { method: "POST" },
  );
  return {
    ok: Boolean(result.data?.ok),
    alreadyRegistered: Boolean(result.data?.alreadyRegistered),
    error: result.error,
  };
}

export async function createEventClient(payload: EventPayload) {
  const result = await request<{ event: EventInfo }>("/api/events", { method: "POST", body: payload });
  return { event: result.data?.event ?? null, error: result.error };
}

export async function updateEventClient(slug: string, payload: EventPayload) {
  const result = await request<{ event: EventInfo }>(`/api/events/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: payload,
  });
  return { event: result.data?.event ?? null, error: result.error };
}

// ---------------------------------------------------------------------------
// Participant, teams, invites
// ---------------------------------------------------------------------------

export async function fetchParticipantOverviewClient(): Promise<ParticipantEntry[] | null> {
  const data = await getOrNull<{ entries: ParticipantEntry[] }>("/api/participant/overview");
  return data?.entries ?? null;
}

export async function fetchMyTeamClient(event?: string) {
  return getOrNull<{ team: TeamSummary | null }>(`/api/teams/mine${qs({ event })}`);
}

export async function fetchTeamClient(teamId: string) {
  return request<{ team: TeamSummary }>(`/api/teams/${teamId}`);
}

export async function fetchTeamMembersClient(teamId: string) {
  return getOrNull<{ members: TeamMemberInfo[] }>(`/api/teams/${teamId}/members`);
}

export async function createTeamClient(name: string, event: string, description?: string) {
  const result = await request<{ team: TeamSummary }>("/api/teams", {
    method: "POST",
    body: { name, event, description },
  });
  return { team: result.data?.team ?? null, error: result.error };
}

export function updateTeamClient(teamId: string, name: string, description?: string) {
  return request<{ team: TeamSummary }>(`/api/teams/${teamId}`, {
    method: "PATCH",
    body: { name, description },
  });
}

export function removeTeamMemberClient(teamId: string, memberId: string) {
  return request<{ ok: boolean; teamDeleted: boolean }>(`/api/teams/${teamId}/members/${memberId}`, {
    method: "DELETE",
  });
}

export function changeTeamMemberRoleClient(
  teamId: string,
  memberId: string,
  role: "OWNER" | "ADMIN" | "MEMBER",
) {
  return request<{ ok: boolean }>(`/api/teams/${teamId}/members/${memberId}`, {
    method: "PATCH",
    body: { role },
  });
}

export async function fetchTeamInvitesClient(teamId: string): Promise<TeamInviteInfo[]> {
  const data = await getOrNull<{ invites: TeamInviteInfo[] }>(`/api/teams/${teamId}/invites`);
  return data?.invites ?? [];
}

export async function createTeamInviteClient(
  teamId: string,
  payload?: { expires_in_hours?: number; max_uses?: number },
) {
  const result = await request<{ invite: TeamInviteInfo }>(`/api/teams/${teamId}/invites`, {
    method: "POST",
    body: payload ?? {},
  });
  return { invite: result.data?.invite ?? null, error: result.error };
}

export async function joinTeamInviteClient(token: string) {
  const result = await request<{
    ok: boolean;
    teamId: string;
    teamName: string;
    alreadyMember: boolean;
    message: string;
  }>(`/api/invites/${encodeURIComponent(token)}/join`, { method: "POST", body: {} });
  return {
    teamId: result.data?.teamId ?? null,
    teamName: result.data?.teamName ?? null,
    alreadyMember: result.data?.alreadyMember ?? false,
    message: result.data?.message ?? null,
    error: result.error,
  };
}

export async function revokeTeamInviteClient(token: string) {
  const result = await request<{ ok: boolean }>(`/api/invites/${encodeURIComponent(token)}`, {
    method: "DELETE",
  });
  return { ok: !result.error, error: result.error };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function fetchMyProjectClient(event?: string) {
  return request<{ project: ProjectDetail | null; team: { id: string; name: string }; event: EventRef }>(
    `/api/projects/mine${qs({ event })}`,
  );
}

export async function saveProjectClient(payload: ProjectPayload, existingId?: string) {
  const result = existingId
    ? await request<ProjectDetail>(`/api/projects/${existingId}`, { method: "PATCH", body: payload })
    : await request<ProjectDetail>("/api/projects", { method: "POST", body: payload });
  return { project: result.data, error: result.error };
}

// ---------------------------------------------------------------------------
// Judging (T2)
// ---------------------------------------------------------------------------

export async function fetchJudgeAssignmentsClient(): Promise<JudgeAssignment[]> {
  return (await getOrNull<JudgeAssignment[]>("/api/judge/assignments")) ?? [];
}

export async function fetchJudgeScoresClient(): Promise<JudgeScore[]> {
  return (await getOrNull<JudgeScore[]>("/api/judge/scores")) ?? [];
}

export async function fetchJudgeRubricClient(): Promise<RubricCriterion[]> {
  return (await getOrNull<RubricCriterion[]>("/api/judge/rubric")) ?? [];
}

export async function submitJudgeScoreClient(payload: ScoreSubmitPayload) {
  const result = await request<JudgeScore>("/api/judge/scores", { method: "POST", body: payload });
  return { score: result.data, error: result.error };
}

// ---------------------------------------------------------------------------
// Organizer
// ---------------------------------------------------------------------------

export function fetchOrganizerStatsClient(event?: string): Promise<OrganizerStats | null> {
  return getOrNull<OrganizerStats>(`/api/organizer/stats${qs({ event })}`);
}

export async function fetchOrganizerEventsClient(): Promise<OrganizerEvent[] | null> {
  const data = await getOrNull<{ events: OrganizerEvent[] }>("/api/organizer/events");
  return data?.events ?? null;
}

export function fetchEventSubmissionsClient(slug: string) {
  return request<EventSubmissions>(`/api/organizer/events/${encodeURIComponent(slug)}/submissions`);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function fetchAdminStatsClient(): Promise<AdminStats | null> {
  return getOrNull<AdminStats>("/api/admin/stats");
}

export async function fetchAdminUsersClient(params: { q?: string; role?: string } = {}) {
  const data = await getOrNull<{ total: number; users: AdminUser[] }>(
    `/api/admin/users${qs(params)}`,
  );
  return data ?? { total: 0, users: [] };
}

export function setUserRoleClient(userId: string, role: UserRole) {
  return request<{ ok: boolean; user: AdminUser }>(`/api/admin/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
}

export function setUserSuspendedClient(userId: string, suspended: boolean) {
  return request<{ ok: boolean; user: AdminUser }>(
    `/api/admin/users/${userId}/${suspended ? "suspend" : "unsuspend"}`,
    { method: "PATCH" },
  );
}

export async function fetchAuditLogClient(action?: string): Promise<AuditEntry[]> {
  const data = await getOrNull<{ logs: AuditEntry[] }>(`/api/admin/audit${qs({ action, limit: "100" })}`);
  return data?.logs ?? [];
}
