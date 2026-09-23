// =============================================================================
// Supabase Browser Client — lib/supabase/client.ts
// =============================================================================
//
// WHY this file exists:
//   Next.js Client Components run in the browser. They need a Supabase client
//   that stores session tokens in browser cookies, not server-side cookies().
//   createBrowserClient from @supabase/ssr handles this automatically.
//
// WHEN to use this client:
//   Import createClient() from this file only in 'use client' components.
//   For Server Components, Server Actions, and Route Handlers, use
//   lib/supabase/server.ts instead.
//
// KEY POINT — only NEXT_PUBLIC_ variables here:
//   This file is included in the browser bundle. Never import server-only
//   variables (DATABASE_URL, service keys) from this file.
// =============================================================================

import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client suitable for use in browser (Client Component) code.
 * Call this inside a component or hook — do not create it at module level,
 * as that would prevent per-request isolation in SSR.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
