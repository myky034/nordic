// =============================================================================
// Auth Session Helpers — lib/auth/session.ts
// =============================================================================
//
// WHY this file exists:
//   These helpers centralise auth checks so that every page and layout uses
//   the same verified, consistent approach. They are the Data Access Layer
//   (DAL) boundary for authentication — following the Next.js recommendation
//   to perform auth checks close to the data, not only in layouts.
//
// THREE helpers with distinct purposes:
//
//   getAuthClaims()   — Verifies the current user's identity by calling
//                       supabase.auth.getClaims(). Returns the decoded JWT
//                       claims (sub, email, role, etc.) or null. Use this
//                       for authorization decisions. It validates the JWT
//                       signature locally — no extra network call needed for
//                       projects using asymmetric signing keys (the default).
//
//   requireAuth()     — Calls getAuthClaims() and redirects to /login if
//                       the user is not authenticated. Use in layouts and
//                       pages that must be private. Never returns null.
//
//   getCurrentUser()  — Calls supabase.auth.getUser() which makes a network
//                       round-trip to the Supabase Auth server to retrieve
//                       the latest user record. Use ONLY when you actually
//                       need up-to-date user data (e.g., displaying the
//                       user's email). Do NOT use for authorization checks —
//                       use getAuthClaims() instead.
//
// WHY not getSession() for authorization?
//   supabase.auth.getSession() reads session data from cookies without
//   verifying the JWT signature. In server code where cookies can potentially
//   be manipulated, this is not safe for authorization decisions. getClaims()
//   verifies the signature and is the correct method.
// =============================================================================

import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the verified JWT claims for the current user, or null if
 * the user is not authenticated or the token is invalid.
 *
 * Backed by supabase.auth.getClaims() — validates the JWT signature
 * locally using the project's JWKS. Safe for authorization decisions.
 */
export async function getAuthClaims() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return null;
  }

  return data.claims;
}

/**
 * Enforces authentication. Redirects to /login if the user is not
 * authenticated. Returns the verified JWT claims when the user is signed in.
 *
 * Use at the top of protected pages and layouts.
 */
export async function requireAuth() {
  const claims = await getAuthClaims();

  if (!claims) {
    // redirect() in Next.js throws a special error that Next.js catches and
    // handles as a 307 redirect. It never returns.
    redirect("/login");
  }

  return claims;
}

/**
 * Returns the full user record from the Supabase Auth server.
 * Makes a network round-trip — only call this when you actually need
 * up-to-date user data such as email or metadata for display purposes.
 *
 * Do NOT use this for authorization decisions — use getAuthClaims() instead.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    return null;
  }

  return data.user;
}
