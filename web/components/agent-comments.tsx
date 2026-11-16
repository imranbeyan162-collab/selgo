// web/components/agent-comments.tsx
"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import { api, ApiError, type AgentComment } from "../lib/api";
import { formatDate } from "../lib/format";
import { INPUT, PRIMARY_BUTTON } from "../lib/styles";

function Avatar({ comment }: { comment: AgentComment }) {
  if (comment.author_avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={comment.author_avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel-2 text-sm font-semibold text-white">
      {comment.author_name.charAt(0).toUpperCase()}
    </span>
  );
}

export function AgentComments({ agentId }: { agentId: number }) {
  const [comments, setComments] = useState<AgentComment[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .comments(agentId)
      .then((list) => {
        if (!cancelled) setComments(list);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const comment = await api.addComment(agentId, text);
      setComments((current) => [...(current ?? []), comment]);
      setBody("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Your comment wasn't posted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(comment: AgentComment) {
    if (busy) return;
    setBusy(true);
    try {
      await api.deleteComment(agentId, comment.id);
      setComments((current) => (current ?? []).filter((item) => item.id !== comment.id));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "That comment wasn't deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="text-lg font-semibold text-white">
        Comments{comments && comments.length > 0 ? ` (${comments.length})` : ""}
      </h2>

      {comments === null ? <p className="mt-3 text-sm text-muted">Loading comments…</p> : null}
      {comments !== null && comments.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No comments yet. If you&apos;ve tried this agent, say how it went.</p>
      ) : null}

      {comments && comments.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-4">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar comment={comment} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold text-white">{comment.author_name}</span>{" "}
                  <span className="text-muted">{formatDate(comment.created_at)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-200">
                  {comment.body}
                </p>
                {comment.is_mine ? (
                  <button
                    type="button"
                    onClick={() => void onDelete(comment)}
                    disabled={busy}
                    className="mt-1 text-xs text-muted underline hover:text-danger"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        <label className="sr-only" htmlFor="new-comment">
          Your comment
        </label>
        <textarea
          id="new-comment"
          value={body}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setBody(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Share how this agent worked for you"
          className={INPUT}
        />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div>
          <button type="submit" disabled={busy || !body.trim()} className={PRIMARY_BUTTON}>
            Post comment
          </button>
        </div>
      </form>
      <p className="mt-2 text-xs text-muted">Comments show the name and photo from your Account page.</p>
    </section>
  );
}
