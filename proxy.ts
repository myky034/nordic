// =============================================================================
// Next.js Proxy — proxy.ts (project root)
// =============================================================================
//
// In Next.js 16, "Proxy" is the new name for what was previously called
// "Middleware". The file is still named proxy.ts and works identically —
// it runs on the Edge runtime before any page or API route is rendered.
//
// WHY this file exists:
//   The Supabase auth session (access + refresh tokens) is stored in cookies.
//   Access tokens expire after ~1 hour. Without this Proxy, an expired token
//   would cause the user to appear logged out even though they have a valid
//   refresh token. Server Components cannot write cookies, so the refresh
//   must happen here.
//
// WHAT this does:
//   Delegates entirely to updateSession() in lib/supabase/proxy.ts, which
//   calls supabase.auth.getClaims() to refresh the token if needed, then
//   propagates the updated cookies on both the request and response.
//
// matcher config:
//   We exclude Next.js internals and static assets so the Proxy does not
//   run unnecessarily on files that never need an auth session.
// =============================================================================

import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT paths starting with:
     *   - _next/static  (Next.js static files)
     *   - _next/image   (Next.js image optimisation)
     *   - favicon.ico   (browser favicon request)
     * Also excludes common static file extensions.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
