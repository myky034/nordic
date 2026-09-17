// =============================================================================
// Landing Page — app/(public)/page.tsx  →  route: /
// =============================================================================
//
// This is the public home page of the portal. It replaces the create-next-app
// scaffold page (app/page.tsx was deleted as part of Slice 1).
//
// NOTE: No data is displayed here beyond the portal name and description.
// Displaying any country, university, immigration, or labour market data
// requires a source — no fabricated content is shown (AGENTS.md rule 1.1).
// =============================================================================

import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Europe Study &amp; Career Intelligence Portal
        </h1>

        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          One place to research Europe with evidence, compare options, and turn
          research into an actionable study-to-career plan.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/countries" className="inline-flex h-10 items-center rounded-full border px-6 text-sm">Explore countries</Link>
          <Link href="/sources" className="inline-flex h-10 items-center rounded-full border px-6 text-sm">Source registry</Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
