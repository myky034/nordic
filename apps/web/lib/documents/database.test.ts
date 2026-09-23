import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

const db = new PGlite();
const sourceId = "11111111-1111-4111-8111-111111111111";
beforeAll(async () => {
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; GRANT USAGE ON SCHEMA public TO anon, authenticated;");
  for (const path of ["20260917090000_countries_sources", "20260918090000_documents"]) {
    await db.exec(readFileSync(`../../packages/db/prisma/migrations/${path}/migration.sql`, "utf8"));
  }
  expect((await db.query("SELECT * FROM documents")).rows).toHaveLength(0);
  await db.query("INSERT INTO sources (id, name, canonical_url) VALUES ($1, 'Synthetic test source', 'https://example.com/')", [sourceId]);
}, 30000);
afterAll(async () => { await db.close(); });
async function role<T>(roleName: "anon" | "authenticated" | "nordic_ingestor", work: () => Promise<T>) {
  // Change session identity too: a superuser session can SET ROLE to any role
  // even after SET ROLE anon, which would not test an unprivileged connection.
  await db.exec(`SET SESSION AUTHORIZATION ${roleName}`);
  try { return await work(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
async function insert(hash = "a".repeat(64), source = sourceId, url = "https://example.com/document") {
  return db.query("INSERT INTO documents (source_id, canonical_url, content_hash, metadata_hash, retrieved_at, ingestion_method) VALUES ($1,$2,$3,$4,'2026-01-01T00:00:00Z','manual') ON CONFLICT DO NOTHING RETURNING id", [source, url, hash, "b".repeat(64)]);
}
it("ingestor can append documents and unchanged retries cannot duplicate rows", async () => {
  await role("nordic_ingestor", async () => {
    expect((await insert()).rows).toHaveLength(1);
    expect((await insert()).rows).toHaveLength(0);
    expect((await insert("c".repeat(64))).rows).toHaveLength(1);
  });
  expect((await db.query("SELECT * FROM documents")).rows).toHaveLength(2);
});
it("keeps provenance when identical bytes appear at a different URL", async () => {
  expect((await role("nordic_ingestor", () => insert("a".repeat(64), sourceId, "https://example.com/other"))).rows).toHaveLength(1);
});
for (const actor of ["anon", "authenticated"] as const) {
  it(`${actor} reads documents but cannot write or assume ingestor role`, async () => {
    await role(actor, async () => {
      expect((await db.query("SELECT * FROM documents")).rows.length).toBeGreaterThan(0);
      await expect(insert()).rejects.toThrow(/permission denied/i);
      await expect(db.exec("UPDATE documents SET title = 'tamper'")).rejects.toThrow(/permission denied/i);
      await expect(db.exec("DELETE FROM documents")).rejects.toThrow(/permission denied/i);
      await expect(db.exec("SET ROLE nordic_ingestor")).rejects.toThrow(/permission denied/i);
    });
  });
}
it("ingestor cannot overwrite history or modify source policies", async () => {
  await role("nordic_ingestor", async () => {
    await expect(db.exec("UPDATE documents SET title = 'tamper'")).rejects.toThrow(/permission denied/i);
    await expect(db.exec("DELETE FROM documents")).rejects.toThrow(/permission denied/i);
    await expect(db.exec("UPDATE sources SET crawl_enabled = true")).rejects.toThrow(/permission denied/i);
  });
});
it("RLS blocks public writes even if table privileges are accidentally granted", async () => {
  await db.exec("GRANT INSERT, UPDATE, DELETE ON documents TO authenticated");
  try {
    await role("authenticated", async () => {
      await expect(insert("d".repeat(64))).rejects.toThrow(/row-level security/i);
      expect((await db.query("UPDATE documents SET title = 'tamper' RETURNING id")).rows).toHaveLength(0);
      expect((await db.query("DELETE FROM documents RETURNING id")).rows).toHaveLength(0);
    });
  } finally { await db.exec("REVOKE INSERT, UPDATE, DELETE ON documents FROM authenticated"); }
});
it("enforces FK, hash, excerpt length and honest status at database boundary", async () => {
  await expect(insert("e".repeat(64), "22222222-2222-4222-8222-222222222222")).rejects.toThrow(/foreign key/i);
  await expect(insert("invalid")).rejects.toThrow(/documents_hash_check/);
  await expect(db.exec("UPDATE documents SET processing_status = 'verified'")).rejects.toThrow(/documents_status_check/);
  await expect(db.exec("UPDATE documents SET excerpt = repeat('x', 501)")).rejects.toThrow(/documents_text_check/);
});
