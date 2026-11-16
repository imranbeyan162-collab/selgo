// web/components/coming-soon.tsx
import Link from "next/link";

// Placeholder for pages that are built in later steps.
export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      <p className="mt-3 text-base text-muted">{text}</p>
      <Link href="/" className="mt-6 inline-block text-sm text-brand-soft underline">
        Back to the Selgo AI Mentor
      </Link>
    </div>
  );
}
