// web/components/workspace-chat.tsx
"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";

import { api, ApiError, type Subscription, type WorkspaceMessage } from "../lib/api";
import { PRIMARY_BUTTON } from "../lib/styles";

// Working with your own copy of an agent. The whole conversation is saved:
// it is the agent's memory of your business.
export function WorkspaceChat({ sub }: { sub: Subscription }) {
  const [messages, setMessages] = useState<WorkspaceMessage[] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .workspaceMessages(sub.id)
      .then((list) => {
        if (!cancelled) setMessages(list);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sub.id]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, sending]);

  async function send() {
    const message = input.trim();
    if (!message || sending || !sub.can_use) return;
    setSending(true);
    setError(null);
    setInput("");
    try {
      const result = await api.workspaceChat(sub.id, message);
      setMessages((current) => [...(current ?? []), result.question, result.reply]);
    } catch (caught) {
      setInput(message);
      setError(caught instanceof ApiError ? caught.message : "Your message wasn't sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <section aria-label={`Conversation with ${sub.agent.name}`} className="flex flex-col rounded-2xl border border-line bg-panel">
      <div ref={listRef} className="flex h-[min(60vh,32rem)] flex-col gap-3 overflow-y-auto p-5">
        {messages === null ? <p className="text-sm text-muted">Loading your conversation…</p> : null}
        {messages !== null && messages.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            This is your own copy of {sub.agent.name}. Tell it what you need. It remembers this conversation, and you
            can shape how it works under &quot;Customize this agent&quot; below.
          </p>
        ) : null}
        {(messages ?? []).map((message) => (
          <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                message.role === "user" ? "bg-brand text-white" : "bg-panel-2 text-slate-100"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {sending ? <p className="text-sm text-muted">{sub.agent.name} is working on it…</p> : null}
      </div>

      {sub.can_use ? (
        <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-line p-4">
          <textarea
            value={input}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={4000}
            placeholder={`Message ${sub.agent.name}`}
            aria-label={`Message to ${sub.agent.name}`}
            className="max-h-40 min-h-12 min-w-0 flex-1 resize-none rounded-xl border border-line bg-bg px-4 py-3 text-base text-white placeholder:text-muted outline-none transition focus:border-brand"
          />
          <button type="submit" disabled={sending || !input.trim()} className={PRIMARY_BUTTON}>
            Send
          </button>
        </form>
      ) : (
        <p className="border-t border-line p-4 text-sm text-muted">
          {sub.status === "cancelled"
            ? "This subscription is cancelled. Subscribe again from the agent's page to keep working."
            : sub.status === "trial_ended"
              ? "Your free trial has ended. Paid plans are coming soon."
              : "This agent is no longer available."}
        </p>
      )}
      {error ? (
        <p role="alert" className="px-4 pb-4 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
