// =============================================================================
// Dashboard Page — app/(app)/dashboard/page.tsx  →  route: /dashboard
// =============================================================================
//
// This is the landing page for authenticated users. In Slice 1 it only
// confirms the user is signed in. Domain content is added in later slices.
//
// WHY both requireAuth() and getCurrentUser() here?
//   - requireAuth() (backed by getClaims) ensures we bail out fast if the
//     token is somehow invalid — it does not make a network call.
//   - getCurrentUser() makes a network call to get the actual user record
//     with email, metadata, etc. We call it here because we want to DISPLAY
//     the user's email — an appropriate reason for the extra round-trip.
//   The layout already called requireAuth(), but we call it again here per
//   the Next.js recommendation to check auth close to the data that needs it.
// =============================================================================

import { requireAuth } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import Link from "next/link";

export default async function DashboardPage() {
  // Verify identity via JWT claims — fast, no network call.
  await requireAuth();

  // Fetch the user record to display their email.
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>

      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Signed in as{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-50">
          {user?.email ?? "unknown"}
        </span>
      </p>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link href="/countries" className="rounded-xl border px-5 py-3">Explore countries →</Link>
        <Link href="/sources" className="rounded-xl border px-5 py-3">Browse source registry →</Link>
      </div>
    </div>
  );
}
