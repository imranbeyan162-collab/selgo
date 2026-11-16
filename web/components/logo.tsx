// web/components/logo.tsx
// The Selgo mark, taken from the original SelgoLogo.tsx.

export function Logo({ showTagline = false }: { showTagline?: boolean }) {
  return (
    <span className="inline-flex select-none items-center gap-2.5">
      <svg className="h-8 w-8 shrink-0" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <path
          d="M84 12 C52 22, 16 28, 16 48 C16 60, 34 65, 48 60 L38 52 C29 52, 28 46, 36 42 C48 36, 74 30, 84 12 Z"
          fill="#0066FF"
        />
        <path
          d="M16 88 C48 78, 84 72, 84 52 C84 40, 66 35, 52 40 L62 48 C71 48, 72 54, 64 58 C52 64, 26 70, 16 88 Z"
          fill="#1D4ED8"
        />
      </svg>
      <span className="leading-none">
        <span className="block text-xl font-extrabold tracking-tight text-white">Selgo</span>
        {showTagline ? (
          <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.16em] text-brand-soft">
            AI Agents • Automated for You
          </span>
        ) : null}
      </span>
    </span>
  );
}
