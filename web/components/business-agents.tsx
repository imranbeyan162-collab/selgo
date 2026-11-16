// web/components/business-agents.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api, ApiError, hasClientId, type Subscription } from "../lib/api";
import { formatStatus } from "../lib/format";
import { AgentPortrait } from "./agent-portrait";

// My Business Agents: every agent this business has added.
export function BusinessAgents() {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!hasClientId()) {
      setSubs([]);
      return;
    }
    api
      .subscriptions()
      .then((list) => {
        if (!cancelled) setSubs(list);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : "Your agents could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <h1 className="font-display text-5xl leading-none text-white">My Business Agents</h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
        Your own copies of Selgo&apos;s agents. Each one remembers your conversations and follows your
        instructions.
      </p>

      {error ? (
        <p role="alert" className="mt-8 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {subs === null && !error ? <p className="mt-8 text-sm text-muted">Loading…</p> : null}

      {subs !== null && subs.length === 0 ? (
        <div className="mt-10 max-w-xl">
          <p className="text-base text-slate-200">You haven&apos;t added any agents yet.</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            <Link href="/" className="text-brand-soft underline">
              Tell the Selgo AI Mentor
            </Link>{" "}
            what slows your business down and it will suggest the agents that fit, or browse the{" "}
            <Link href="/market" className="text-brand-soft underline">
              Agent Market
            </Link>
            .
          </p>
        </div>
      ) : null}

      {subs && subs.length > 0 ? (
        <ul className="mt-8 flex flex-col gap-3">
          {subs.map((sub) => (
            <li key={sub.id}>
              <Link
                href={`/business/${sub.id}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 transition hover:border-brand focus-visible:outline-2 focus-visible:outline-brand"
              >
                <AgentPortrait agent={sub.agent} className="h-14 w-14 shrink-0 rounded-xl text-3xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">{sub.agent.name}</span>
                  {sub.agent.expert_name ? (
                    <span className="block truncate text-sm text-muted">Trained on {sub.agent.expert_name}&apos;s work</span>
                  ) : null}
                  <span className={`mt-1 block text-sm ${sub.can_use ? "text-slate-300" : "text-danger"}`}>
                    {formatStatus(sub)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
