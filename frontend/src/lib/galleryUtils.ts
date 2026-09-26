import type { ProjectSummary } from "@/lib/api";

/** Stable hash for deterministic UI placeholders (likes, colors). */
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

const THUMBNAIL_ICONS = ["🚀", "⚡", "🎯", "💡", "🔬", "🛠", "🌐", "📱", "🤖", "🎨"];

export function projectThumbnail(project: ProjectSummary) {
  const hash = hashString(project.id);
  return {
    gradient: THUMBNAIL_GRADIENTS[hash % THUMBNAIL_GRADIENTS.length],
    icon: THUMBNAIL_ICONS[hash % THUMBNAIL_ICONS.length],
  };
}

export function projectStats(project: ProjectSummary) {
  const hash = hashString(project.id + project.teamName);
  return {
    likes: 5 + (hash % 120),
    comments: hash % 15,
  };
}

export function teamAvatars(teamName: string) {
  const parts = teamName.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : teamName.slice(0, 2).toUpperCase();

  const hash = hashString(teamName);
  const colors = [
    "bg-violet-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
  ];

  const count = 1 + (hash % 3);
  return Array.from({ length: count }, (_, i) => ({
    initial: i === 0 ? initials[0] : initials[i % initials.length] || "?",
    color: colors[(hash + i) % colors.length],
  }));
}

export function groupProjectsByTrack(
  projects: ProjectSummary[],
  tracks: Array<{ id: string; name: string }>,
): Array<{ trackId: string; trackName: string; projects: ProjectSummary[] }> {
  const byTrack = new Map<string, ProjectSummary[]>();

  for (const project of projects) {
    const list = byTrack.get(project.trackName) ?? [];
    list.push(project);
    byTrack.set(project.trackName, list);
  }

  const ordered: Array<{
    trackId: string;
    trackName: string;
    projects: ProjectSummary[];
  }> = [];

  for (const track of tracks) {
    const list = byTrack.get(track.name);
    if (list?.length) {
      ordered.push({
        trackId: track.id,
        trackName: track.name,
        projects: list,
      });
    }
  }

  for (const [trackName, list] of byTrack) {
    if (!tracks.some((t) => t.name === trackName)) {
      ordered.push({ trackId: "", trackName, projects: list });
    }
  }

  return ordered;
}
