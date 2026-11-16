// web/components/agent-row.tsx
import Link from "next/link";

import type { AgentCard } from "../lib/api";
import { formatPrice } from "../lib/format";
import { AgentPortrait } from "./agent-portrait";
import { ReactionBar } from "./reaction-bar";

// A compact market row for an everyday business agent.
export function AgentRow({ agent }: { agent: AgentCard }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-panel">
      <Link
        href={`/market/${agent.slug}`}
        className="group flex gap-4 p-4 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      >
        <AgentPortrait agent={agent} className="h-14 w-14 shrink-0 rounded-xl text-3xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="font-semibold text-white group-hover:underline group-hover:underline-offset-4">
              {agent.name}
            </h3>
            <span className="text-sm text-slate-300">{formatPrice(agent.monthly_price)}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted">{agent.tagline}</p>
          <p className="mt-1 text-xs text-muted">{agent.industry}</p>
        </div>
      </Link>
      <div className="pb-2 pl-[4.75rem] pr-2">
        <ReactionBar agent={agent} />
      </div>
    </article>
  );
}
