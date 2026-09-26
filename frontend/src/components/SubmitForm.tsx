"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { EventInfo } from "@/lib/api";

export function SubmitForm({ event }: { event: EventInfo | null }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const closed = event
    ? new Date() > new Date(event.submissionsClose)
    : true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const res = await fetch("/projects/new", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, summary, repo_url: repoUrl }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.detail ?? data.error ?? `Error ${res.status}`);
      return;
    }
    setMessage("Submission received.");
  }

  return (
    <div className="space-y-6">
      {closed ? (
        <Alert tone="warning" title="Submissions closed">
          The fixture event closed on{" "}
          {event
            ? new Date(event.submissionsClose).toUTCString()
            : "the deadline"}
          . New submissions are blocked by the backend.
        </Alert>
      ) : (
        <Alert tone="success" title="Submissions open">
          You can submit a project until the deadline.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Project title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={closed}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm disabled:bg-slate-100"
            placeholder="My awesome hack"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Summary
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={closed}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm disabled:bg-slate-100"
            placeholder="One line of what it does"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Repository URL
          </label>
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            disabled={closed}
            type="url"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm disabled:bg-slate-100"
            placeholder="https://github.com/..."
          />
        </div>

        <p className="text-sm text-slate-500">
          Sign in as a <strong>participant</strong> on the login page before
          submitting.
        </p>

        <Button type="submit" disabled={closed}>
          Submit project
        </Button>
      </form>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
    </div>
  );
}
