import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Anonymous Supabase client (publishable key, no user session).
 *
 * WHY: search and comparison must show exactly what the public sees. With the
 * normal cookie-based client, an editor's session would make RLS return drafts
 * and unverified immigration/labour figures. Using the anon role here makes the
 * database's public RLS rules the single source of truth for these pages.
 * It carries no secret: the publishable key is already public.
 */
export function createPublicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
