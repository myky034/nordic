// =============================================================================
// OAuth Callback Route Handler — app/auth/callback/route.ts  →  /auth/callback
// =============================================================================
//
// IMPORTANT — route placement:
//   This file is at app/auth/callback/route.ts (plain directory, NOT a route
//   group). The URL is /auth/callback, which matches exactly the redirectTo
//   value in the signInWithOAuth() call in app/(auth)/login/page.tsx.
//
//   The (auth) route group used for the login page layout is a UI-only
//   grouping and maps /login — it does NOT affect this route.
//
// HOW the PKCE callback works:
//   1. Google redirects the browser here with ?code=<authorization_code>.
//   2. We call exchangeCodeForSession() which:
//        a. Sends the authorization code to Supabase Auth.
//        b. Supabase verifies the code and PKCE verifier.
//        c. Returns a session (access token + refresh token).
//        d. @supabase/ssr stores the session tokens in cookies automatically.
//   3. We redirect the user to /dashboard (authenticated area).
//
// WHY PKCE (Proof Key for Code Exchange)?
//   PKCE prevents authorization code interception attacks. The client
//   generates a random code verifier before starting the OAuth flow, sends
//   a hashed version (code challenge) to the provider, and must present the
//   original verifier when exchanging the code for a token. Without PKCE,
//   a stolen authorization code could be used by an attacker.
// =============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (!code) {
    // No code present — likely a direct visit or an error from the provider.
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Exchange failed — the code may be expired or already used.
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Session established — redirect to the authenticated dashboard.
  return NextResponse.redirect(`${origin}/dashboard`);
}
