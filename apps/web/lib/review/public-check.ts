import "server-only";
import { createPublicClient } from "@/lib/supabase/public";

export type PublicTable = "facts" | "immigration_rules" | "occupations" | "universities" | "programmes";

/**
 * Which of these ids can a signed-out visitor read right now?
 *
 * WHY the anonymous client: an editor's own client sees drafts through the
 * editor RLS policies, so it cannot answer "is this public?". Asking as `anon`
 * makes the database's public policies the only judge — the same path the
 * public pages use (lib/supabase/public.ts).
 *
 * Returns null when the check fails. The caller must show "unknown", never
 * assume public or hidden. Only ids are selected, so nothing else leaks.
 */
export async function publicIds(table: PublicTable, ids: string[]): Promise<Set<string> | null> {
  if (!ids.length) return new Set();
  const { data, error } = await createPublicClient().from(table).select("id").in("id", ids);
  if (error) {
    console.error({ source: "review", operation: `public_check_${table}`, timestamp: new Date().toISOString(), status: "failed", category: "visibility_check_failed" });
    return null;
  }
  return new Set((data as { id: string }[]).map((r) => r.id));
}
