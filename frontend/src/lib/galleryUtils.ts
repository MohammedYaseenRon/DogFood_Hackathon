import type { ProjectSummary } from "@/lib/api";

/** Stable hash so a project always gets the same placeholder colour. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Flat cover tiles drawn from the palette: [background, text]. */
const COVERS: Array<{ bg: string; fg: string }> = [
  { bg: "bg-ink", fg: "text-signal-300" },
  { bg: "bg-zinc-100", fg: "text-ink" },
  { bg: "bg-signal-100", fg: "text-ink" },
  { bg: "bg-brand-50", fg: "text-brand-700" },
];

/** Placeholder cover for projects without a thumbnail — stable per project. */
export function projectThumbnail(project: Pick<ProjectSummary, "id" | "title">) {
  const cover = COVERS[hashString(project.id) % COVERS.length];
  const words = project.title.split(/\s+/).filter(Boolean);
  const monogram = ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
  return { ...cover, monogram };
}

/** Turn YouTube / Vimeo / Loom links into an embeddable player URL. */
export function videoEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = parsed.searchParams.get("v") ?? parsed.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "vimeo.com") {
    const id = parsed.pathname.match(/^\/(\d+)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === "loom.com") {
    const id = parsed.pathname.match(/^\/share\/([\w-]+)/)?.[1];
    return id ? `https://www.loom.com/embed/${id}` : null;
  }
  return null;
}
