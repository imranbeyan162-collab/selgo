// web/components/reaction-bar.tsx
"use client";

import { useState } from "react";

import { api, type AgentCard, type ReactionType } from "../lib/api";
import { BoltIcon, BookmarkIcon, ChatIcon, HeartIcon } from "./icons";

const BUTTONS: { type: ReactionType; label: string; Icon: typeof HeartIcon; count: "likes" | "saves" | "boosts" }[] = [
  { type: "like", label: "Like", Icon: HeartIcon, count: "likes" },
  { type: "save", label: "Save", Icon: BookmarkIcon, count: "saves" },
  { type: "boost", label: "Boost", Icon: BoltIcon, count: "boosts" },
];

type Counts = Pick<AgentCard, "likes" | "saves" | "boosts" | "my_reactions">;

// Like / save / boost. One of each per person: tapping again takes it back.
// The count changes straight away and is corrected by the server's answer.
export function ReactionBar({ agent, showComments = true }: { agent: AgentCard; showComments?: boolean }) {
  const [counts, setCounts] = useState<Counts>({
    likes: agent.likes,
    saves: agent.saves,
    boosts: agent.boosts,
    my_reactions: agent.my_reactions,
  });
  const [busy, setBusy] = useState<ReactionType | null>(null);

  async function toggle(type: ReactionType, count: "likes" | "saves" | "boosts") {
    if (busy) return;
    const before = counts;
    const on = counts.my_reactions.includes(type);
    setCounts({
      ...counts,
      [count]: Math.max(0, counts[count] + (on ? -1 : 1)),
      my_reactions: on ? counts.my_reactions.filter((t) => t !== type) : [...counts.my_reactions, type],
    });
    setBusy(type);
    try {
      const result = await api.react(agent.id, type);
      setCounts((current) => ({
        likes: result.likes,
        saves: result.saves,
        boosts: result.boosts,
        my_reactions: result.active
          ? Array.from(new Set([...current.my_reactions, type]))
          : current.my_reactions.filter((t) => t !== type),
      }));
    } catch {
      setCounts(before); // put it back if the server didn't take it
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {BUTTONS.map(({ type, label, Icon, count }) => {
        const on = counts.my_reactions.includes(type);
        return (
          <button
            key={type}
            type="button"
            aria-label={`${label} (${counts[count]})`}
            aria-pressed={on}
            onClick={() => void toggle(type, count)}
            className={`flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm tabular-nums transition hover:bg-panel-2 focus-visible:outline-2 focus-visible:outline-brand ${
              on ? "text-brand-soft" : "text-muted"
            }`}
          >
            <Icon filled={on} className="h-[18px] w-[18px]" />
            {counts[count]}
          </button>
        );
      })}
      {showComments ? (
        <span className="flex min-h-10 items-center gap-1.5 px-2.5 text-sm tabular-nums text-muted" aria-label={`${agent.comments} comments`}>
          <ChatIcon className="h-[18px] w-[18px]" />
          {agent.comments}
        </span>
      ) : null}
    </div>
  );
}
