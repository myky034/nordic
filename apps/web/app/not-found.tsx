// =============================================================================
// 404 Not Found Page — app/not-found.tsx
// =============================================================================
//
// Next.js renders this component when:
//   - A route is not matched by the file system.
//   - A Server Component calls notFound() from 'next/navigation'.
// =============================================================================

import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";

export default async function NotFoundPage() {
  const t = (await getDictionary()).notFound;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">404</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-ink">{t.title}</h1>
      <p className="mt-2 text-[17px] text-ink-2">{t.text}</p>
      <Link href="/" className="mt-8 rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-white transition hover:bg-accent-hover">
        {t.home}
      </Link>
    </div>
  );
}
