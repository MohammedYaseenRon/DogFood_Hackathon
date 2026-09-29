"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  deleteCommentClient,
  fetchCommentsClient,
  hideCommentClient,
  postCommentClient,
  type CommentInfo,
} from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { loginHref } from "@/lib/role-auth";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

const MAX = 2000;

export function ProjectComments({ projectId }: { projectId: string }) {
  const [comments, setComments] = useState<CommentInfo[] | null>(null);
  const [canComment, setCanComment] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      fetchCommentsClient(projectId).then((res) => {
        if (res.data) {
          setComments(res.data.comments);
          setCanComment(res.data.canComment);
        }
      }),
    [projectId],
  );

  useEffect(() => {
    let active = true;
    fetchCommentsClient(projectId).then((res) => {
      if (!active || !res.data) return;
      setComments(res.data.comments);
      setCanComment(res.data.canComment);
    });
    return () => {
      active = false;
    };
  }, [projectId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postCommentClient(projectId, body.trim());
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setBody("");
    await load();
  }

  async function remove(comment: CommentInfo) {
    if (!window.confirm("Delete this comment?")) return;
    const res = await deleteCommentClient(comment.id);
    if (res.error) setError(res.error);
    await load();
  }

  async function moderate(comment: CommentInfo) {
    let reason: string | undefined;
    if (!comment.hidden) {
      const answer = window.prompt("Why hide this comment? Recorded in the audit trail.");
      if (answer === null) return;
      reason = answer.trim() || undefined;
    }
    const res = await hideCommentClient(comment.id, !comment.hidden, reason);
    if (res.error) setError(res.error);
    await load();
  }

  if (!comments) return null;

  return (
    <section aria-labelledby="comments-title" className="space-y-5">
      <div className="flex items-end justify-between gap-3 border-b border-line pb-3">
        <h2 id="comments-title" className="font-display text-lg font-semibold text-ink">
          Comments <span className="font-mono text-sm font-normal text-zinc-400">{comments.filter((c) => !c.hidden).length}</span>
        </h2>
      </div>

      {comments.length === 0 ? <p className="text-sm text-zinc-500">No comments yet. Be the first to say something useful.</p> : null}

      <ul className="space-y-3">
        {comments.map((comment) => (
          <li
            key={comment.id}
            className={`rounded-xl border p-4 ${comment.hidden ? "border-dashed border-amber-300 bg-amber-50/60" : "border-line bg-white"}`}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink font-display text-xs font-semibold text-white">
                {comment.author.charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold text-ink">{comment.author}</span>
              {comment.fromTeam ? (
                <span className="rounded-md bg-signal-100 px-1.5 py-0.5 font-mono text-[10px] text-signal-600 uppercase">team</span>
              ) : null}
              <span className="text-xs text-zinc-400">{relativeTime(comment.createdAt)}</span>
              {comment.hidden ? (
                <span className="font-mono text-[10px] text-amber-700 uppercase">
                  hidden{comment.hiddenReason ? ` · ${comment.hiddenReason}` : ""}
                </span>
              ) : null}
              <span className="ml-auto flex gap-3">
                {comment.canModerate ? (
                  <button type="button" onClick={() => void moderate(comment)} className="font-mono text-[11px] text-zinc-500 uppercase hover:text-ink">
                    {comment.hidden ? "Unhide" : "Hide"}
                  </button>
                ) : null}
                {comment.canDelete ? (
                  <button type="button" onClick={() => void remove(comment)} className="font-mono text-[11px] text-red-600 uppercase hover:underline">
                    Delete
                  </button>
                ) : null}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-zinc-700">{comment.body}</p>
          </li>
        ))}
      </ul>

      {canComment ? (
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="comment-body" className="field-label">
            Add a comment
          </label>
          <textarea
            id="comment-body"
            rows={3}
            maxLength={MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="field"
            placeholder="Questions, feedback, kind words. Be specific."
          />
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] text-zinc-400">
              {body.length}/{MAX} · max 2 links
            </span>
            <Button type="submit" size="sm" disabled={busy || body.trim().length < 2}>
              {busy ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="rounded-xl border border-line bg-zinc-50 p-4 text-sm text-zinc-600">
          <Link href={loginHref(`/projects/${projectId}`)} className="font-semibold text-brand-700 underline-offset-4 hover:underline">
            Sign in
          </Link>{" "}
          to join the conversation.
        </p>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </section>
  );
}
