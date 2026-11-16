// web/components/business-agent.tsx
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, ApiError, type Subscription } from "../lib/api";
import { formatPrice, formatStatus } from "../lib/format";
import { DANGER_BUTTON } from "../lib/styles";
import { AgentPortrait } from "./agent-portrait";
import { AgentSettings } from "./agent-settings";
import { WorkspaceChat } from "./workspace-chat";

// One of my business agents: work with it, customize it, or cancel.
export function BusinessAgent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const subscriptionId = Number(id);
    if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
      setError("This agent isn't in your business agents.");
      return;
    }
    api
      .subscription(subscriptionId)
      .then((found) => {
        if (!cancelled) setSub(found);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(
          caught instanceof ApiError && caught.status === 404
            ? "This agent isn't in your business agents."
            : "This agent could not be loaded. Please try again.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function cancelSubscription() {
    if (!sub || cancelling) return;
    if (!window.confirm(`Cancel ${sub.agent.name}? Your conversation and settings are kept if you come back.`)) return;
    setCancelling(true);
    try {
      await api.cancelSubscription(sub.id);
      router.push("/business");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "It wasn't cancelled. Please try again.");
      setCancelling(false);
    }
  }

  const back = (
    <Link href="/business" className="text-sm text-brand-soft hover:underline">
      Back to My Business Agents
    </Link>
  );

  if (error && !sub) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        {back}
        <p className="mt-6 text-base text-slate-200">{error}</p>
      </div>
    );
  }

  if (!sub) {
    return <p className="px-4 py-10 text-center text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-16 pt-6">
      {back}

      <header className="flex items-center gap-4">
        <AgentPortrait agent={sub.agent} className="h-16 w-16 shrink-0 rounded-2xl text-4xl" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-4xl leading-none text-white">{sub.agent.name}</h1>
          <p className={`mt-2 text-sm ${sub.can_use ? "text-slate-300" : "text-danger"}`}>
            {formatStatus(sub)}
            {sub.status === "trial" && sub.monthly_price > 0 ? `, then ${formatPrice(sub.monthly_price).toLowerCase()}` : ""}
          </p>
        </div>
      </header>

      <WorkspaceChat sub={sub} />

      <AgentSettings sub={sub} onSaved={setSub} />

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/market/${sub.agent.slug}`} className="text-sm text-brand-soft hover:underline">
          See this agent in the market
        </Link>
        {sub.status !== "cancelled" ? (
          <button type="button" onClick={() => void cancelSubscription()} disabled={cancelling} className={DANGER_BUTTON}>
            {cancelling ? "Cancelling…" : "Cancel subscription"}
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
