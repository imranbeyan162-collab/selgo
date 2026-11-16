// web/components/agent-suggestions.tsx
import Link from "next/link";

import type { AgentCard } from "../lib/api";
import { formatPrice } from "../lib/format";
import { AgentPortrait } from "./agent-portrait";

// The agents the mentor recommends, shown right under its answer.
export function AgentSuggestions({ agents }: { agents: AgentCard[] }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-xs text-muted">{agents.length === 1 ? "An agent that fits" : "Agents that fit"}</p>
      {agents.map((agent) => (
        <Link
          key={agent.id}
          href={`/market/${agent.slug}`}
          className="flex items-center gap-3 rounded-xl border border-line bg-panel p-3 transition hover:border-brand focus-visible:outline-2 focus-visible:outline-brand"
        >
          <AgentPortrait agent={agent} className="h-12 w-12 shrink-0 rounded-lg text-2xl" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-xl leading-tight text-white">
              {agent.expert_name ?? agent.name}
            </span>
            <span className="block truncate text-sm text-muted">
              {agent.expert_name ? agent.name : agent.tagline}
            </span>
          </span>
          <span className="shrink-0 text-right text-sm text-slate-300">{formatPrice(agent.monthly_price)}</span>
        </Link>
      ))}
    </div>
  );
}
