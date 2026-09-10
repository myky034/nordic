// =============================================================================
// Supabase Server Client — lib/supabase/server.ts
// =============================================================================
//
// WHY this file exists:
//   Next.js Server Components, Server Actions, and Route Handlers run on the
//   server and cannot access the browser's cookie store directly. They must
//   read and write cookies through Next.js's cookies() API.
//   createServerClient from @supabase/ssr bridges this gap.
//
// WHEN to use this client:
//   Whenever you need Supabase access in server-side code:
//     - Server Components (page.tsx, layout.tsx without 'use client')
//     - Server Actions ('use server' functions)
//     - Route Handlers (route.ts)
//
// WHY 'server-only':
//   The 'server-only' package causes a build-time error if this module is
//   ever imported from a Client Component ('use client'). This is a safety
//   guard — it prevents accidental inclusion of server secrets in the
//   browser bundle.
//
// IMPORTANT — cookie handling in Next.js App Router:
//   Server Components can READ cookies but cannot WRITE them.
//   Writing cookies (e.g., refreshing tokens) must happen in the Proxy
//   (proxy.ts) or in Route Handlers/Server Actions.
//   The cookie setter here is provided for completeness in those contexts.
// =============================================================================

import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client for use in server-side code.
 * Must be called inside an async function so that cookies() can be awaited.
 */
export async function createClient() {
  // cookies() is async in Next.js 16 — must be awaited.
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        // Read all cookies from the incoming request.
        getAll() {
          return cookieStore.getAll();
        },
        // Write cookies back to the response.
        // In a pure Server Component this is a no-op (Next.js will warn),
        // which is why token refresh must happen in proxy.ts instead.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Silently ignored in Server Components where writes are not allowed.
            // The Proxy (proxy.ts) handles the actual refresh write.
          }
        },
      },
    },
  );
}
