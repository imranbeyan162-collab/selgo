// web/components/market.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { api, ApiError, type AgentCard } from "../lib/api";
import { AgentRow } from "./agent-row";
import { ExpertCard } from "./expert-card";
import { SearchIcon } from "./icons";

const SEARCH_DELAY_MS = 300;

// The Agent Market: search, filter by industry, and two groups of agents.
export function Market() {
  const [all, setAll] = useState<AgentCard[] | null>(null); // every agent, for the industry list
  const [agents, setAgents] = useState<AgentCard[] | null>(null); // what matches right now
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ask the server again a moment after typing stops, or when the industry changes.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api
        .agents({ q: query.trim() || undefined, industry: industry ?? undefined })
        .then((list) => {
          if (cancelled) return;
          setAgents(list);
          setError(null);
          if (!query.trim() && !industry) setAll(list);
        })
        .catch((caught) => {
          if (cancelled) return;
          setError(caught instanceof ApiError ? caught.message : "The market could not be loaded.");
        });
    }, query ? SEARCH_DELAY_MS : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, industry]);

  const industries = useMemo(
    () => Array.from(new Set((all ?? []).map((agent) => agent.industry))).sort((a, b) => a.localeCompare(b)),
    [all],
  );
  const experts = (agents ?? []).filter((agent) => agent.expert_name);
  const business = (agents ?? []).filter((agent) => !agent.expert_name);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <header className="max-w-2xl">
        <h1 className="font-display text-5xl leading-none text-white sm:text-6xl">Agent Market</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Agents trained on proven experts, and agents built for everyday business work. Try any of them before
          you subscribe.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-3">
        <label className="relative block">
          <span className="sr-only">Search the market</span>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            placeholder="Search agents, experts or industries"
            className="w-full rounded-xl border border-line bg-panel py-3 pl-12 pr-4 text-base text-white placeholder:text-muted outline-none transition focus:border-brand"
          />
        </label>

        {industries.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by industry">
            {[null, ...industries].map((name) => {
              const active = industry === name;
              return (
                <button
                  key={name ?? "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setIndustry(name)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm transition focus-visible:outline-2 focus-visible:outline-brand ${
                    active ? "border-brand bg-brand text-white" : "border-line text-slate-300 hover:bg-panel-2"
                  }`}
                >
                  {name ?? "All"}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-10 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {agents === null && !error ? <p className="mt-10 text-sm text-muted">Loading agents…</p> : null}

      {agents !== null && agents.length === 0 ? (
        <div className="mt-12 max-w-xl">
          <p className="text-base text-slate-200">
            {query.trim() || industry ? "No agents match that." : "No agents are published yet."}
          </p>
          <p className="mt-2 text-sm text-muted">
            Try another word, or{" "}
            <Link href="/" className="text-brand-soft underline">
              tell the Selgo AI Mentor
            </Link>{" "}
            what you need and it will point you to the right agent.
          </p>
        </div>
      ) : null}

      {experts.length > 0 ? (
        <section className="mt-12" aria-labelledby="experts-heading">
          <h2 id="experts-heading" className="text-xl font-semibold text-white">
            Trained on experts
          </h2>
          <p className="mt-1 text-sm text-muted">Each one learned from a named expert&apos;s own work, with their permission.</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {experts.map((agent) => (
              <ExpertCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      ) : null}

      {business.length > 0 ? (
        <section className="mt-12" aria-labelledby="business-heading">
          <h2 id="business-heading" className="text-xl font-semibold text-white">
            Business agents
          </h2>
          <p className="mt-1 text-sm text-muted">Built by Selgo for everyday work in your business.</p>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {business.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
