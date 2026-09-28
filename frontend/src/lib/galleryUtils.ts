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

const THUMBNAIL_GRADIENTS = [
  "from-violet-500 via-purple-500 to-fuchsia-500",
  "from-blue-500 via-indigo-500 to-violet-600",
  "from-cyan-500 via-teal-500 to-emerald-500",
  "from-orange-400 via-rose-500 to-pink-500",
  "from-amber-400 via-orange-500 to-red-500",
  "from-sky-400 via-blue-500 to-indigo-600",
  "from-lime-400 via-green-500 to-teal-600",
  "from-fuchsia-500 via-pink-500 to-rose-500",
];

/** Placeholder art for projects without a thumbnail. */
export function projectThumbnail(project: Pick<ProjectSummary, "id">) {
  return {
    gradient: THUMBNAIL_GRADIENTS[hashString(project.id) % THUMBNAIL_GRADIENTS.length],
  };
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
