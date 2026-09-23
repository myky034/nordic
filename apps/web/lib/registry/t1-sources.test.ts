import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
const db = new PGlite();
beforeAll(async () => {
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;");
  for (const migration of ["20260917090000_countries_sources", "20260919110000_t1_source_candidates"]) {
    await db.exec(readFileSync(`../../packages/db/prisma/migrations/${migration}/migration.sql`, "utf8"));
  }
}, 30000);
afterAll(() => db.close());

it("applies cleanly against every CHECK constraint from the Slice 2 migration", async () => {
  expect((await db.query("SELECT id FROM sources")).rows).toHaveLength(2 + 15);
});
it("registers exactly 3 candidate T1/T2 sources per MVP country, none pre-approved for crawling", async () => {
  const rows = (await db.query<{
    slug: string; source_tier: string; status: string; crawl_enabled: boolean; crawl_policy: string; topics: string[];
  }>(`SELECT c.slug, s.source_tier, s.status, s.crawl_enabled, s.crawl_policy, s.topics
      FROM sources s JOIN countries c ON c.id = s.country_id
      WHERE s.canonical_url NOT IN ('https://eures.europa.eu/index_en', 'https://www.hotcourses.vn/europe/')
      ORDER BY c.slug, s.name`)).rows;
  expect(rows).toHaveLength(15);
  for (const slug of ["denmark", "finland", "netherlands", "norway", "sweden"]) {
    expect(rows.filter((r) => r.slug === slug)).toHaveLength(3);
  }
  for (const row of rows) {
    // AI-compiled candidates never self-promote to verified or crawl-approved (AGENTS.md Section 1.3/9).
    expect(row.status).toBe("needs_verification");
    expect(row.crawl_enabled).toBe(false);
    expect(row.crawl_policy).toBe("not_reviewed");
    expect(["T1", "T2"]).toContain(row.source_tier);
    expect(row.topics.length).toBeGreaterThan(0);
  }
});
it("classifies the one government-funded-but-independent operator as T2, everything else T1", async () => {
  const nuffic = (await db.query<{ source_tier: string }>("SELECT source_tier FROM sources WHERE canonical_url = 'https://www.studyinnl.org/'")).rows[0];
  expect(nuffic.source_tier).toBe("T2");
  const t1Count = (await db.query(
    "SELECT id FROM sources WHERE canonical_url NOT IN ('https://eures.europa.eu/index_en', 'https://www.hotcourses.vn/europe/') AND source_tier = 'T1'",
  )).rows.length;
  expect(t1Count).toBe(14);
});
