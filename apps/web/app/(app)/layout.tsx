// =============================================================================
// Authenticated App Shell Layout — app/(app)/layout.tsx
// =============================================================================
//
// This layout wraps all authenticated routes (e.g., /dashboard).
// It enforces authentication on every route in the (app) group.
//
// WHY auth check in a layout and not just in pages?
//   Placing the check here means every route inside (app) is automatically
//   protected. New routes added to this group inherit the protection without
//   needing their own auth check.
//
// IMPORTANT CAVEAT (from Next.js docs):
//   Due to partial rendering, layouts do not re-render on every client-side
//   navigation within the group. Auth checks in layouts are therefore a
//   useful first line of defence but should also be performed in the DAL
//   (lib/auth/session.ts) and close to data fetches. See dashboard/page.tsx
//   for the per-page pattern.
//
// Sign-out:
//   The sign-out form uses a Server Action. The action calls
//   supabase.auth.signOut(), which clears the session cookies, then
//   redirects to the landing page. Using a form + Server Action avoids the
//   need for a client component just for the sign-out button.
// =============================================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SiteFooter, SiteHeader } from "@/components/site-header";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export default async function AppLayout({
  children,
}: { children: React.ReactNode }) {
  // requireAuth() redirects to /login if the user is not authenticated.
  // It returns the verified JWT claims when the user is signed in.
  await requireAuth();

  // Same global navigation as public pages, with workspace + sign-out actions.
  return (
    <>
      <SiteHeader
        right={
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="rounded-full px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink">Workspace</Link>
            <form action={signOut}>
              <button type="submit" className="rounded-full bg-fill px-3.5 py-1.5 text-[13px] font-medium text-ink transition hover:bg-fill-strong">
                Sign out
              </button>
            </form>
          </div>
        }
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:px-8 sm:py-16">{children}</main>
      <SiteFooter />
    </>
  );
}
