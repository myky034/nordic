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
// Header:
//   The account area (Workspace + Đăng xuất) comes from SiteHeader, the same
//   component the public pages use (components/account-actions.tsx).
// =============================================================================

import { requireAuth } from "@/lib/auth/session";
import { SiteFooter, SiteHeader } from "@/components/site-header";

export default async function AppLayout({
  children,
}: { children: React.ReactNode }) {
  // requireAuth() redirects to /login if the user is not authenticated.
  // It returns the verified JWT claims when the user is signed in.
  await requireAuth();

  // Same global navigation and account area as the public pages.
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:px-8 sm:py-16">{children}</main>
      <SiteFooter />
    </>
  );
}
