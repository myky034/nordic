import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { compareReady, topicsCovered, type CountryCounts, type CoverageTopic } from "./domain";

export type PublicCoverage = { countries: Record<string, { topics: CoverageTopic[] }>; compareReady: boolean };

// Read with the anonymous client, so RLS counts exactly what a visitor can
// open. Cached for five minutes across requests: the header needs
// compareReady on every page, and a newly reviewed item may take up to five
// minutes to change a label or reveal the comparison page.
// unstable_cache does not cache a thrown error, so a failed read is retried
// on the next request instead of being remembered.
const load = unstable_cache(async (): Promise<PublicCoverage> => {
  const client = createPublicClient();
  const [countries, programmes, rules, occupations, facts] = await Promise.all([
    client.from("countries").select("id,slug"),
    client.from("programmes").select("universities!programmes_university_id_fkey(country_id)").limit(10000),
    client.from("immigration_rules").select("country_id").limit(10000),
    client.from("occupations").select("country_id").limit(10000),
    client.from("facts").select("country_id,topic,fact_type_id,fact_types(comparable)").limit(10000),
  ]);
  const failed = [countries, programmes, rules, occupations, facts].find((r) => r.error);
  if (failed) throw new Error(`coverage_read_failed: ${failed.error?.message}`);
  const counts = new Map<string, CountryCounts>();
  const of = (id: string | null | undefined) => {
    if (!id) return null;
    if (!counts.has(id)) counts.set(id, { programmes: 0, rules: 0, occupations: 0, factsByTopic: {} });
    return counts.get(id)!;
  };
  for (const p of programmes.data as unknown as { universities: { country_id: string } | null }[]) { const c = of(p.universities?.country_id); if (c) c.programmes++; }
  for (const r of rules.data as { country_id: string }[]) { const c = of(r.country_id); if (c) c.rules++; }
  for (const o of occupations.data as { country_id: string | null }[]) { const c = of(o.country_id); if (c) c.occupations++; }
  const factRows = facts.data as unknown as { country_id: string | null; topic: string; fact_type_id: string | null; fact_types: { comparable: boolean } | null }[];
  for (const f of factRows) { const c = of(f.country_id); if (c) c.factsByTopic[f.topic] = (c.factsByTopic[f.topic] ?? 0) + 1; }
  const empty: CountryCounts = { programmes: 0, rules: 0, occupations: 0, factsByTopic: {} };
  return {
    countries: Object.fromEntries((countries.data as { id: string; slug: string }[]).map((c) => [c.slug, { topics: topicsCovered(counts.get(c.id) ?? empty) }])),
    // Only types marked comparable feed the comparison table (L3a).
    compareReady: compareReady(factRows.flatMap((f) => (f.fact_type_id && f.country_id && f.fact_types?.comparable ? [{ fact_type_id: f.fact_type_id, country_id: f.country_id }] : []))),
  };
}, ["public-coverage-v1"], { revalidate: 300, tags: ["public-coverage"] });

/**
 * Public coverage, or null when it cannot be read. Callers must then fall
 * back to the previous behaviour (show the comparison link, no coverage
 * label) — never hide content or claim "no data" on a failed read
 * (AGENTS.md §13). The failure is logged.
 */
export async function publicCoverage(): Promise<PublicCoverage | null> {
  try { return await load(); }
  catch (e) {
    console.error({ source: "coverage", operation: "public_coverage", timestamp: new Date().toISOString(), status: "failed", category: "coverage_read_failed", message: e instanceof Error ? e.message.slice(0, 200) : "unknown" });
    return null;
  }
}
