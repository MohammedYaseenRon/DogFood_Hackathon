/**
 * Server-component data access. Calls the backend directly and forwards the
 * visitor's session cookie so server-rendered pages see what that user may see
 * (their own drafts, unpublished events for organizers, ...).
 */
import { cookies } from "next/headers";
import {
  backendUrl,
  type EventInfo,
  type EventSubmissions,
  type GalleryFacets,
  type InvitePreview,
  type ProjectDetail,
  type ProjectSummary,
  type PublicStats,
  type UserInfo,
} from "@/lib/api";

async function serverFetch<T>(path: string): Promise<T | null> {
  const cookieHeader = (await cookies()).toString();
  try {
    const res = await fetch(`${backendUrl}${path}`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchMe(): Promise<UserInfo | null> {
  return serverFetch<UserInfo>("/api/auth/me");
}

export async function fetchProjects(params: {
  q?: string;
  track?: string;
  event?: string;
  tag?: string;
  sort?: string;
} = {}): Promise<ProjectSummary[]> {
  return (await serverFetch<ProjectSummary[]>(`/api/projects${qs(params)}`)) ?? [];
}

export async function fetchGalleryFacets(event?: string): Promise<GalleryFacets> {
  return (
    (await serverFetch<GalleryFacets>(`/api/projects/facets${qs({ event })}`)) ?? {
      total: 0,
      tracks: [],
      tags: [],
    }
  );
}

export async function fetchProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const data = await serverFetch<{ project: ProjectDetail }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
  );
  return data?.project ?? null;
}

/** The featured event: the one accepting submissions, else the next or latest. */
export async function fetchFeaturedEvent(): Promise<EventInfo | null> {
  const data = await serverFetch<{ event: EventInfo | null }>("/api/event");
  return data?.event ?? null;
}

export async function fetchEvents(scope?: "all"): Promise<EventInfo[]> {
  const data = await serverFetch<{ events: EventInfo[] }>(`/api/events${qs({ scope })}`);
  return data?.events ?? [];
}

export async function fetchEventBySlug(slug: string): Promise<EventInfo | null> {
  const data = await serverFetch<{ event: EventInfo }>(`/api/events/${encodeURIComponent(slug)}`);
  return data?.event ?? null;
}

export async function fetchPublicStats(): Promise<PublicStats | null> {
  return serverFetch<PublicStats>("/api/stats/public");
}

export async function fetchInvitePreview(token: string): Promise<InvitePreview | null> {
  return serverFetch<InvitePreview>(`/api/invites/${encodeURIComponent(token)}`);
}

export async function fetchEventSubmissions(slug: string): Promise<EventSubmissions | null> {
  return serverFetch<EventSubmissions>(`/api/organizer/events/${encodeURIComponent(slug)}/submissions`);
}
