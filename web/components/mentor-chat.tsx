// web/components/mentor-chat.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { api, ApiError, CHATS_CHANGED_EVENT, type ChatTurn } from "../lib/api";
import { PRIMARY_BUTTON } from "../lib/styles";

const SUGGESTIONS = [
  "Which parts of my business could an AI agent take over?",
  "How do I get more customers without hiring?",
  "Help me work out what to automate first.",
];

function readChatId(value: string | null): number | null {
  return value !== null && /^\d+$/.test(value) ? Number(value) : null;
}

// The mentor conversation. The open chat comes from the address bar:
// "/" is a new chat, "/?chat=12" is saved chat 12.
export function MentorChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = readChatId(searchParams.get("chat"));

  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Open the chat named in the address bar, or start fresh.
  useEffect(() => {
    if (requestedId === sessionIdRef.current) return; // already on screen
    let cancelled = false;
    setError(null);

    if (requestedId === null) {
      sessionIdRef.current = null;
      setMessages([]);
      return;
    }

    setLoadingChat(true);
    api
      .chatSession(requestedId)
      .then((chat) => {
        if (cancelled) return;
        sessionIdRef.current = chat.id;
        setMessages(chat.messages.map((m) => ({ role: m.role, content: m.content })));
      })
      .catch(() => {
        if (cancelled) return;
        sessionIdRef.current = null;
        setMessages([]);
        setError("That chat could not be opened.");
      })
      .finally(() => {
        if (!cancelled) setLoadingChat(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestedId]);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending || loadingChat) return;

    const before = messages;
    const withQuestion: ChatTurn[] = [...before, { role: "user", content: message }];
    setMessages(withQuestion);
    setInput("");
    setError(null);
    setSending(true);

    try {
      const result = await api.mentorChat(message, sessionIdRef.current);
      setMessages([...withQuestion, { role: "assistant", content: result.reply }]);

      if (result.session_id !== sessionIdRef.current) {
        // A new chat was saved: put it in the address bar and the drawer list.
        sessionIdRef.current = result.session_id;
        router.replace(`/?chat=${result.session_id}`, { scroll: false });
      }
      window.dispatchEvent(new Event(CHATS_CHANGED_EVENT));
    } catch (caught) {
      // Put things back so the user can simply try again.
      setMessages(before);
      setInput(message);
      setError(caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  // Enter sends. Shift + Enter makes a new line.
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(input);
    }
  }

  const empty = messages.length === 0 && !loadingChat;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
          {empty ? (
            <div className="pt-6 text-center sm:pt-14">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-soft">
                AI Agents • Automated for You
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                What does your business need help with?
              </h1>
              <p className="mx-auto mt-3 max-w-md text-base text-muted">
                Tell the Selgo AI Mentor about your business. It finds what slows you down and which
                tasks an AI agent can take over.
              </p>
              <div className="mt-8 flex flex-col gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={sending}
                    onClick={() => void send(suggestion)}
                    className="rounded-xl border border-line bg-panel px-4 py-3 text-left text-sm text-slate-200 transition hover:border-brand disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((turn, index) => (
              <div
                key={index}
                className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                    turn.role === "user"
                      ? "bg-brand text-white"
                      : "border border-line bg-panel text-slate-100"
                  }`}
                >
                  {turn.content}
                </div>
              </div>
            ))
          )}

          {loadingChat ? <p className="text-center text-sm text-muted">Opening chat…</p> : null}

          {sending ? (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-muted">
                Mentor is thinking…
              </div>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-bg">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          {error ? (
            <p role="alert" className="mb-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={4000}
              placeholder="Ask the mentor…"
              aria-label="Message to the mentor"
              className="max-h-40 min-h-12 min-w-0 flex-1 resize-none rounded-xl border border-line bg-panel px-4 py-3 text-base text-white placeholder:text-muted outline-none transition focus:border-brand"
            />
            <button
              type="submit"
              disabled={sending || loadingChat || input.trim().length === 0}
              className={PRIMARY_BUTTON}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
