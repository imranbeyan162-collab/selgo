// web/lib/styles.ts
// Shared Tailwind class lists, so buttons and inputs look the same everywhere.
// Colors (bg, panel, line, brand, muted...) are defined in app/globals.css.

export const PRIMARY_BUTTON =
  "inline-flex shrink-0 items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-bright disabled:cursor-not-allowed disabled:opacity-50";

export const SMALL_BUTTON =
  "inline-flex items-center justify-center rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-white transition hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-50";

export const INPUT =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-base text-white placeholder:text-muted outline-none transition focus:border-brand";

export const CARD = "rounded-2xl border border-line bg-panel";

export const DANGER_BUTTON =
  "inline-flex items-center justify-center rounded-lg border border-danger/40 px-3.5 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50";
