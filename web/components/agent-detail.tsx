// web/components/agent-detail.tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api, ApiError, type AgentCard } from "../lib/api";
import { formatPrice, formatSources } from "../lib/format";
import { AgentComments } from "./agent-comments";
import { AgentPortrait } from "./agent-portrait";
import { ReactionBar } from "./reaction-bar";
import { SubscribeButton } from "./subscribe-button";
import { TryAgent } from "./try-agent";

// One agent's page: who it is, what it does, a live preview and comments.
export function AgentDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [agent, setAgent] = useState<AgentCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .agentBySlug(slug)
      .then((found) => {
        if (!cancelled) setAgent(found);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(
          caught instanceof ApiError && caught.status === 404
            ? "This agent isn't in the market."
            : "This agent could not be loaded. Please try again.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const back = (
    <Link href="/market" className="text-sm text-brand-soft hover:underline">
      Back to the Agent Market
    </Link>
  );

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        {back}
        <p className="mt-6 text-base text-slate-200">{error}</p>
      </div>
    );
  }

  if (!agent) {
    return <p className="px-4 py-10 text-center text-sm text-muted">Loading…</p>;
  }

  const isExpert = Boolean(agent.expert_name);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 pb-16 pt-6">
      {back}

      <header className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <AgentPortrait
          agent={agent}
          className={`shrink-0 rounded-2xl ${isExpert ? "h-40 w-40 text-6xl" : "h-24 w-24 text-5xl"}`}
        />
        <div className="min-w-0">
          <h1 className="font-display text-5xl leading-none text-white sm:text-6xl">
            {isExpert ? agent.expert_name : agent.name}
          </h1>
          {isExpert ? (
            <p className="mt-3 text-base text-slate-300">
              {agent.expert_title ? `${agent.expert_title}. ` : ""}
              This is <span className="font-semibold text-white">{agent.name}</span>, an AI agent trained on their
              work with their permission.
            </p>
          ) : (
            <p className="mt-3 text-base text-slate-300">{agent.industry}</p>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-4 border-y border-line py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-white">{formatPrice(agent.monthly_price)}</p>
          <p className="text-sm text-muted">{formatSources(agent.knowledge_sources)}</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <div className="-ml-2.5 sm:ml-0">
            <ReactionBar agent={agent} showComments={false} />
          </div>
          <SubscribeButton agent={agent} />
        </div>
      </div>

      <section aria-labelledby="about-heading" className="max-w-2xl">
        <h2 id="about-heading" className="text-lg font-semibold text-white">
          What it does
        </h2>
        <p className="mt-1 text-base text-slate-300">{agent.tagline}</p>
        <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-slate-300">{agent.description}</p>
      </section>

      {isExpert && agent.expert_bio ? (
        <section aria-labelledby="expert-heading" className="max-w-2xl">
          <h2 id="expert-heading" className="text-lg font-semibold text-white">
            About {agent.expert_name}
          </h2>
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-slate-300">{agent.expert_bio}</p>
        </section>
      ) : null}

      <TryAgent agent={agent} />

      <AgentComments agentId={agent.id} />
    </div>
  );
}
