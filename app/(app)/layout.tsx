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

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export default async function AppLayout({
  children,
}: LayoutProps<"/dashboard">) {
  // requireAuth() redirects to /login if the user is not authenticated.
  // It returns the verified JWT claims when the user is signed in.
  await requireAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Europe Portal
        </span>

        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Sign out
          </button>
        </form>
      </nav>

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
