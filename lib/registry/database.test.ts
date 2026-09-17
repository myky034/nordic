import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
beforeAll(async () => {
  // Supabase owns these roles in production; this disposable database simulates them.
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;");
  await db.exec(readFileSync("prisma/migrations/20260917090000_countries_sources/migration.sql", "utf8"));
}, 30000);
afterAll(async () => { await db.close(); });

async function asRole<T>(role: "anon" | "authenticated", query: string) {
  await db.exec(`SET ROLE ${role}`);
  try { return await db.query<T>(query); } finally { await db.exec("RESET ROLE"); }
}

describe("migration, seed and RLS", () => {
  it("seeds only approved scope with no invented verification or coverage", async () => {
    const countries = await db.query<{ name: string }>("SELECT name FROM countries ORDER BY name");
    expect(countries.rows.map((r) => r.name)).toEqual(["Denmark", "Finland", "Netherlands", "Norway", "Sweden"]);
    const sources = await db.query("SELECT canonical_url, source_tier, country_id, last_verified_at, last_crawled_at, crawl_enabled FROM sources ORDER BY name");
    expect(sources.rows).toEqual([
      { canonical_url: "https://eures.europa.eu/index_en", source_tier: null, country_id: null, last_verified_at: null, last_crawled_at: null, crawl_enabled: false },
      { canonical_url: "https://www.hotcourses.vn/europe/", source_tier: null, country_id: null, last_verified_at: null, last_crawled_at: null, crawl_enabled: false },
    ]);
  });
  for (const role of ["anon", "authenticated"] as const) {
    it(`${role} can read public countries and sources`, async () => {
      expect((await asRole(role, "SELECT * FROM countries")).rows).toHaveLength(5);
      expect((await asRole(role, "SELECT * FROM sources")).rows).toHaveLength(2);
    });
    it(`${role} cannot insert, update or delete registry records`, async () => {
      for (const table of ["countries", "sources"]) {
        for (const sql of [`INSERT INTO ${table} DEFAULT VALUES`, `UPDATE ${table} SET name = 'changed'`, `DELETE FROM ${table}`]) {
          await expect(asRole(role, sql)).rejects.toThrow(/permission denied/i);
        }
      }
    });
  }
  it("RLS still blocks writes even if a table write grant is accidentally added", async () => {
    await db.exec("GRANT INSERT, UPDATE, DELETE ON countries, sources TO authenticated");
    try {
      await expect(asRole("authenticated", "INSERT INTO countries (name, slug) VALUES ('test', 'test')")).rejects.toThrow(/row-level security/i);
      await expect(asRole("authenticated", "INSERT INTO sources (name, canonical_url) VALUES ('test', 'https://example.com/')")).rejects.toThrow(/row-level security/i);
      for (const table of ["countries", "sources"]) {
        expect((await asRole("authenticated", `UPDATE ${table} SET name = 'changed' RETURNING id`)).rows).toHaveLength(0);
        expect((await asRole("authenticated", `DELETE FROM ${table} RETURNING id`)).rows).toHaveLength(0);
      }
    } finally { await db.exec("REVOKE INSERT, UPDATE, DELETE ON countries, sources FROM authenticated"); }
  });
  it("rejects duplicates, invalid relationships and unsupported verification", async () => {
    await expect(db.exec("INSERT INTO sources (name, canonical_url) VALUES ('duplicate', 'https://eures.europa.eu/index_en')")).rejects.toThrow(/unique/i);
    await expect(db.exec("UPDATE sources SET country_id = '00000000-0000-0000-0000-000000000001'")).rejects.toThrow(/foreign key/i);
    await expect(db.exec("UPDATE sources SET status = 'verified'")).rejects.toThrow(/sources_review_check/);
    await expect(db.exec("UPDATE sources SET crawl_enabled = true")).rejects.toThrow(/sources_crawl_check/);
    await expect(db.exec("UPDATE sources SET source_tier = 'official'")).rejects.toThrow(/sources_tier_check/);
    await expect(db.exec("UPDATE sources SET canonical_url = 'javascript:alert(1)'")).rejects.toThrow(/sources_url_check/);
  });
});
