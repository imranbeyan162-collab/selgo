// web/components/subscribe-button.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, ApiError, hasClientId, type AgentCard, type Subscription } from "../lib/api";
import { formatStatus } from "../lib/format";
import { PRIMARY_BUTTON } from "../lib/styles";

// On an agent's page: start using it, or open the copy you already have.
export function SubscribeButton({ agent }: { agent: AgentCard }) {
  const router = useRouter();
  const [existing, setExisting] = useState<Subscription | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!hasClientId()) {
      setChecked(true);
      return;
    }
    api
      .subscriptions()
      .then((subs) => {
        if (!cancelled) setExisting(subs.find((sub) => sub.agent.id === agent.id) ?? null);
      })
      .catch(() => {
        // Not knowing just means we offer to subscribe; the server sorts out duplicates.
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [agent.id]);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const sub = await api.subscribe(agent.id);
      router.push(`/business/${sub.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "That didn't work. Please try again.");
      setBusy(false);
    }
  }

  if (!checked) return null;

  if (existing && existing.status !== "cancelled") {
    return (
      <div className="flex flex-col items-start gap-1">
        <Link href={`/business/${existing.id}`} className={PRIMARY_BUTTON}>
          Open in My Business Agents
        </Link>
        <span className="text-xs text-muted">{formatStatus(existing)}</span>
      </div>
    );
  }

  const label = existing
    ? "Subscribe again"
    : agent.monthly_price > 0
      ? "Start free trial"
      : "Add to my business";

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={() => void start()} disabled={busy} className={PRIMARY_BUTTON}>
        {busy ? "Setting it up…" : label}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : existing ? (
        <span className="text-xs text-muted">Your earlier conversation and settings are kept.</span>
      ) : agent.monthly_price > 0 ? (
        <span className="text-xs text-muted">No payment needed during the trial.</span>
      ) : null}
    </div>
  );
}
