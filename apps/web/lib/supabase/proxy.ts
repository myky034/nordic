// =============================================================================
// Supabase Token Refresh for Proxy — lib/supabase/proxy.ts
// =============================================================================
//
// WHY this file exists:
//   Supabase Auth issues short-lived access tokens (JWTs) and longer-lived
//   refresh tokens. When an access token expires, it must be exchanged for a
//   new one. Server Components cannot write cookies, so the refresh MUST
//   happen in a layer that can write to both the request (for downstream
//   Server Components to see the new token) and the response (so the browser
//   receives the updated cookie).
//
//   Next.js 16's Proxy (proxy.ts at the project root, formerly "Middleware")
//   runs on every matched request before any component renders — making it
//   the correct place to perform this refresh.
//
// HOW the refresh works:
//   1. Proxy calls updateSession(request).
//   2. We create a Supabase client that can read AND write both request and
//      response cookies (using NextRequest / NextResponse).
//   3. We call supabase.auth.getClaims() which:
//        - Reads the access token from cookies.
//        - Verifies the JWT signature locally (JWKS, no network call for new projects).
//        - If expired AND a refresh token exists, exchanges it for a new token.
//        - The new tokens are written back to cookies via setAll.
//   4. We return the modified NextResponse so Next.js propagates the
//      updated cookies to the browser and downstream Server Components.
//
// WHY getClaims() and NOT getSession():
//   getSession() reads session data from cookies without verifying the JWT
//   signature. It MUST NOT be used for authorization decisions in server code
//   because the cookie value can be forged. getClaims() verifies the signature
//   against the project's published public keys — it is the correct method
//   for identity verification.
// =============================================================================

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Refreshes the Supabase auth session and propagates updated cookies.
 * Call this from proxy.ts on every matched request.
 */
export async function updateSession(request: NextRequest) {
  // Start with a passthrough response that we will attach cookies to.
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write updated tokens to the REQUEST so downstream Server Components
          // in this request cycle see the refreshed session immediately.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          // Recreate the response with the updated request cookies, then also
          // set the cookies on the RESPONSE so the browser receives them.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() triggers a token refresh if the access token has expired.
  // The refreshed tokens are written back through setAll above.
  // We do not use the returned claims here — the Proxy's only job is to
  // ensure the token is fresh before the request reaches any page or layout.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
