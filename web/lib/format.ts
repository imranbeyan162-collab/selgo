// web/lib/format.ts

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
