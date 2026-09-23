"use client";

// =============================================================================
// Root Error Boundary — app/error.tsx
// =============================================================================
//
// WHY 'use client':
//   Next.js requires error boundary components to be Client Components.
//   React error boundaries use componentDidCatch / getDerivedStateFromError,
//   which are lifecycle methods only available in client-rendered trees.
//
// WHAT this does:
//   Catches unhandled runtime errors in the root layout's subtree and renders
//   a user-friendly fallback instead of a blank page or a raw stack trace.
//   Never expose error.message or error.stack to users in production.
// =============================================================================

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log to console (or a future error-reporting service).
    // 'digest' is the Next.js-generated anonymous error ID useful for
    // correlating server logs with client-visible errors.
    console.error("[app error]", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
      >
        Try again
      </button>
    </div>
  );
}
