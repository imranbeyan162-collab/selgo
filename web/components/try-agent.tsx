// web/components/try-agent.tsx
"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { api, ApiError, type AgentCard, type ChatTurn } from "../lib/api";
import { PRIMARY_BUTTON, SMALL_BUTTON } from "../lib/styles";

// A short live preview of the agent. Nothing here is saved.
export function TryAgent({ agent }: { agent: AgentCard }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns, sending]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || sending) return;
    const before = turns;
    const withQuestion: ChatTurn[] = [...before, { role: "user", content: message }];
    setTurns(withQuestion);
    setInput("");
    setError(null);
    setSending(true);
    try {
      const result = await api.preview(agent.id, message, before.slice(-12));
      setTurns([...withQuestion, { role: "assistant", content: result.reply }]);
    } catch (caught) {
      setTurns(before);
      setInput(message);
      setError(caught instanceof ApiError ? caught.message : "The preview didn't answer. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const who = agent.expert_name ? `${agent.name}, trained on ${agent.expert_name}'s work` : agent.name;

  return (
    <section aria-labelledby="try-heading" className="rounded-2xl border border-line bg-panel">
      <div className="flex items-start justify-between gap-3 border-b border-line p-5">
        <div>
          <h2 id="try-heading" className="text-lg font-semibold text-white">
            Try it
          </h2>
          <p className="mt-1 text-sm text-muted">Ask {who} about your business. Previews aren&apos;t saved.</p>
        </div>
        {turns.length > 0 ? (
          <button type="button" onClick={() => setTurns([])} disabled={sending} className={SMALL_BUTTON}>
            Clear
          </button>
        ) : null}
      </div>

      <div ref={listRef} className="flex max-h-[26rem] min-h-32 flex-col gap-3 overflow-y-auto p-5">
        {turns.length === 0 ? (
          <p className="text-sm text-muted">Your conversation with the agent appears here.</p>
        ) : (
          turns.map((turn, index) => (
            <div key={index} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                  turn.role === "user" ? "bg-brand text-white" : "bg-panel-2 text-slate-100"
                }`}
              >
                {turn.content}
              </div>
            </div>
          ))
        )}
        {sending ? <p className="text-sm text-muted">{agent.name} is answering…</p> : null}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-line p-4">
        <input
          value={input}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setInput(event.target.value)}
          maxLength={1000}
          placeholder="Ask a question"
          aria-label={`Message to ${agent.name}`}
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-3 text-base text-white placeholder:text-muted outline-none transition focus:border-brand"
        />
        <button type="submit" disabled={sending || !input.trim()} className={PRIMARY_BUTTON}>
          Send
        </button>
      </form>
      {error ? (
        <p role="alert" className="px-5 pb-4 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
