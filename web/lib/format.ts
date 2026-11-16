// web/lib/format.ts

import type { Subscription } from "./api";

export function formatPrice(monthly: number): string {
  if (monthly <= 0) return "Free";
  const amount = Number.isInteger(monthly) ? String(monthly) : monthly.toFixed(2);
  return `$${amount} a month`;
}

export function formatSources(count: number): string {
  return count === 1 ? "Trained on 1 source" : `Trained on ${count} sources`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatStatus(sub: Pick<Subscription, "status" | "trial_days_left">): string {
  switch (sub.status) {
    case "trial":
      return sub.trial_days_left === 1 ? "Free trial, last day" : `Free trial, ${sub.trial_days_left} days left`;
    case "active":
      return "Active";
    case "trial_ended":
      return "Free trial ended";
    case "cancelled":
      return "Cancelled";
  }
}
