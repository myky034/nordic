import type { SupabaseClient } from "@supabase/supabase-js";
import type { CountId } from "./steps";

type Head = PromiseLike<{ count: number | null; error: unknown }>;

/**
 * Pending review work per step (lib/review/steps.ts), counted through the
 * signed-in user's client so RLS scopes every number (same rule as the
 * dashboard). A failed count is null — shown as "—", never as 0
 * (AGENTS.md 13) — and logged.
 */
export async function pendingCounts(client: SupabaseClient): Promise<Record<CountId, number | null>> {
  const head = (table: string, column: string, value: string): Head => client.from(table).select("id", { count: "exact", head: true }).eq(column, value);
  const sum = async (...qs: Head[]) => {
    const rs = await Promise.all(qs);
    if (rs.some((r) => r.error)) return null;
    return rs.reduce((n, r) => n + (r.count ?? 0), 0);
  };
  const entries = await Promise.all(([
    ["sourcesUnverified", () => sum(head("sources", "status", "needs_verification"))],
    ["education", () => sum(head("universities", "status", "proposed"), head("programmes", "status", "proposed"))],
    ["immigration", () => sum(head("immigration_rules", "status", "proposed"))],
    ["labour", () => sum(head("occupations", "status", "proposed"))],
    ["facts", () => sum(head("facts", "status", "proposed"))],
  ] as const).map(async ([id, q]) => [id, await q()] as const));
  const counts = Object.fromEntries(entries) as Record<CountId, number | null>;
  if (Object.values(counts).some((v) => v === null)) console.error({ source: "review", operation: "pending_counts", timestamp: new Date().toISOString(), status: "failed", category: "count_failed" });
  return counts;
}
