"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  fetchMyProjectClient,
  saveProjectClient,
  type EventInfo,
  type MyProject,
} from "@/lib/api";

export function SubmitForm({ event }: { event: EventInfo | null }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [trackId, setTrackId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<"DRAFT" | "SUBMITTED" | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const closed = event
    ? new Date() > new Date(event.submissionsClose)
    : true;

  useEffect(() => {
    fetchMyProjectClient().then((data) => {
      const project = data?.project ?? null;
      if (project) {
        setProjectId(project.id);
        setTitle(project.title);
        setSummary(project.summary);
        setRepoUrl(project.repoUrl);
        setTrackId(project.trackId);
        setProjectStatus(project.status);
      } else if (event?.tracks[0]) {
        setTrackId(event.tracks[0].id);
      }
      setLoading(false);
    });
  }, [event]);

  async function save(status: "DRAFT" | "SUBMITTED") {
    setError(null);
    setMessage(null);

    if (!trackId) {
      setError("Select a track.");
      return;
    }

    setSaving(true);
    const { project, error: saveError } = await saveProjectClient(
      {
        title,
        summary,
        repo_url: repoUrl,
        track_id: trackId,
        status,
      },
      projectId ?? undefined,
    );
    setSaving(false);

    if (saveError) {
      setError(saveError);
      return;
    }

    if (project) {
      setProjectId(project.id);
      setProjectStatus(project.status);
    }

    setMessage(
      status === "DRAFT"
        ? "Draft saved. You can keep editing until the deadline."
        : "Project submitted to the gallery.",
    );
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:bg-zinc-50 disabled:text-zinc-400";

  if (loading) {
    return <p className="text-zinc-500">Loading your project...</p>;
  }

  return (
    <div className="space-y-6">
      {closed ? (
        <Alert tone="warning" title="Submissions closed">
          The event closed on{" "}
          {event
            ? new Date(event.submissionsClose).toUTCString()
            : "the deadline"}
          . New submissions and edits are blocked by the backend.
        </Alert>
      ) : (
        <Alert tone="success" title="Submissions open">
          Save a draft or submit your final project before the deadline.
          {projectStatus === "DRAFT" ? " Your project is currently a draft." : null}
          {projectStatus === "SUBMITTED" ? " Your project is submitted." : null}
        </Alert>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save("SUBMITTED");
        }}
        className="space-y-5"
      >
        <div>
          <label className="mb-2 block text-sm font-semibold text-zinc-700">
            Track
          </label>
          <select
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
            disabled={closed}
            className={inputClass}
          >
            {(event?.tracks ?? []).map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-zinc-700">
            Project title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={closed}
            required
            className={inputClass}
            placeholder="My awesome hack"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-zinc-700">
            Summary
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={closed}
            required
            rows={3}
            className={inputClass}
            placeholder="One line of what it does"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-zinc-700">
            Repository URL
          </label>
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            disabled={closed}
            required
            type="url"
            className={inputClass}
            placeholder="https://github.com/..."
          />
        </div>

        <p className="text-sm text-zinc-400">
          Sign in as a <strong className="text-zinc-600">participant</strong>,
          join or create a team, then save a draft or submit.{" "}
          <a href="/login" className="font-semibold text-violet-600 hover:text-violet-800">
            Sign in →
          </a>
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={closed || saving}
            onClick={() => save("DRAFT")}
          >
            {saving ? "Saving..." : "Save draft"}
          </Button>
          <Button type="submit" disabled={closed || saving} size="lg">
            {saving ? "Saving..." : projectId ? "Update submission" : "Submit project"}
          </Button>
        </div>
      </form>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
    </div>
  );
}
