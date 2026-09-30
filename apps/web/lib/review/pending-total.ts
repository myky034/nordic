import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { pendingCounts } from "./pending-counts";

/**
 * Total proposals waiting for a reviewer (all record kinds; not sources,
 * which are verified by source managers). null if any count failed. Cached
 * per request so the header does not repeat the queries.
 */
export const pendingProposalTotal = cache(async (): Promise<number | null> => {
  const c = await pendingCounts(await createClient());
  const parts = [c.education, c.immigration, c.labour, c.facts];
  return parts.some((v) => v === null) ? null : parts.reduce((n: number, v) => n + (v ?? 0), 0);
});
