// web/components/agent-settings.tsx
"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { api, ApiError, type Subscription } from "../lib/api";
import { INPUT, PRIMARY_BUTTON } from "../lib/styles";

// "Customize this agent": what it should know about the business, and how
// the owner wants it to work. Only this business's copy changes.
export function AgentSettings({ sub, onSaved }: { sub: Subscription; onSaved: (sub: Subscription) => void }) {
  const [context, setContext] = useState(sub.business_context);
  const [instructions, setInstructions] = useState(sub.custom_instructions);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changed = context !== sub.business_context || instructions !== sub.custom_instructions;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !changed) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await api.updateSubscription(sub.id, {
        business_context: context,
        custom_instructions: instructions,
      });
      onSaved(saved);
      setNotice("Saved. Your agent uses this from its next answer.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Your changes weren't saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} aria-labelledby="customize-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="customize-heading" className="text-lg font-semibold text-white">
          Customize this agent
        </h2>
        <p className="mt-1 text-sm text-muted">Only your copy changes. Other businesses using {sub.agent.name} aren&apos;t affected.</p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-200">About your business</span>
        <textarea
          value={context}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setContext(event.target.value)}
          maxLength={4000}
          rows={4}
          placeholder="What you sell, who your customers are, where you are, what matters most right now."
          className={INPUT}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-200">How it should work for you</span>
        <textarea
          value={instructions}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInstructions(event.target.value)}
          maxLength={4000}
          rows={4}
          placeholder="For example: Keep answers short. Never suggest discounts above 10%. Always answer in Amharic."
          className={INPUT}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-sm text-online">{notice}</p> : null}

      <div>
        <button type="submit" disabled={saving || !changed} className={PRIMARY_BUTTON}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
