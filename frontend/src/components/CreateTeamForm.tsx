"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { createTeamClient } from "@/lib/api";

export function CreateTeamForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const { team, error: createError } = await createTeamClient(name.trim());
    setLoading(false);

    if (createError) {
      setError(createError);
      return;
    }

    setMessage(`Team "${team?.name}" created. Share your invite link below.`);
    setName("");
    onCreated();
  }

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-semibold text-zinc-700">
          Team name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          placeholder="The Hackathon Raptors"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create team"}
      </Button>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
    </form>
  );
}
