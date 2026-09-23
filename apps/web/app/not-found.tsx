// =============================================================================
// 404 Not Found Page — app/not-found.tsx
// =============================================================================
//
// Next.js renders this component when:
//   - A route is not matched by the file system.
//   - A Server Component calls notFound() from 'next/navigation'.
// =============================================================================

import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
      >
        Go home
      </Link>
    </div>
  );
}
