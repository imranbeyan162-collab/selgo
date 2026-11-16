// web/components/expert-card.tsx
import Link from "next/link";

import type { AgentCard } from "../lib/api";
import { formatPrice, formatSources } from "../lib/format";
import { AgentPortrait } from "./agent-portrait";
import { ReactionBar } from "./reaction-bar";

// A market card for an agent trained on a named expert. The portrait and the
// expert's name are the one bold element on the page.
export function ExpertCard({ agent }: { agent: AgentCard }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-panel">
      <Link
        href={`/market/${agent.slug}`}
        className="group flex flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      >
        <div className="relative aspect-[4/3] sm:aspect-[4/5]">
          <AgentPortrait agent={agent} className="absolute inset-0 h-full w-full text-7xl" />
          {/* A dark fade so the name stays readable on any photo. */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-panel via-panel/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <h3 className="font-display text-4xl leading-none text-white group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
              {agent.expert_name}
            </h3>
            {agent.expert_title ? <p className="mt-2 text-sm text-slate-300">{agent.expert_title}</p> : null}
          </div>
        </div>
        <div className="flex flex-col gap-3 px-5 pt-4">
          <div>
            <p className="font-semibold text-white">{agent.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{agent.tagline}</p>
          </div>
          <p className="text-sm text-slate-300">
            {formatSources(agent.knowledge_sources)}, {formatPrice(agent.monthly_price).toLowerCase()}
          </p>
        </div>
      </Link>
      <div className="px-2.5 pb-2.5 pt-1">
        <ReactionBar agent={agent} />
      </div>
    </article>
  );
}
