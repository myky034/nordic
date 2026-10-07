import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
import { parseIscedCsv } from "./isced-csv";
// Synthetic users and documents in a disposable in-memory database only. The
// ISCED rows come from the real CSV in docs/data; the "verified" columns are
// replaced with a synthetic reviewer so the tests do not depend on who signed.
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
let doc: string;
const dir = "../../packages/db/prisma/migrations";
const csv = parseIscedCsv(readFileSync("../../docs/data/isced-f-2013.csv", "utf8"));
const verified = csv.rows.map((r) => ({ ...r, verified_by: "Synthetic reviewer", verified_on: "2026-10-06" }));
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for (const name of readdirSync(dir).filter((n) => /^\d{14}_/.test(n)).sort()) {
    await db.exec(readFileSync(`${dir}/${name}/migration.sql`, "utf8"));
  }
  for (const id of [admin, member]) await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await db.query("SELECT bootstrap_administrator($1)", [admin]);
  const source = (await db.query<{ id: string }>("INSERT INTO sources(name,canonical_url,source_tier) VALUES('Synthetic statistics office','https://stats.example.test/','T2') RETURNING id")).rows[0].id;
  doc = (await db.query<{ id: string }>(`INSERT INTO documents(source_id,canonical_url,title,content_hash,metadata_hash,retrieved_at,ingestion_method)
    VALUES($1,'https://stats.example.test/fields.pdf','Synthetic field list',repeat('a',64),repeat('b',64),now(),'manual') RETURNING id`, [source])).rows[0].id;
}, 60000);
afterAll(() => db.close());
async function as<T>(id: string | null, fn: () => Promise<T>) {
  if (id) await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`SET SESSION AUTHORIZATION ${id ? "authenticated" : "anon"}`);
  try { return await fn(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
const importRows = (rows: unknown[], document = doc) => db.query<{ r: { inserted: number; unchanged: number } }>("SELECT import_study_fields($1,$2::jsonb) AS r", [document, JSON.stringify(rows)]);
const count = async () => Number((await db.query<{ n: string }>("SELECT count(*) AS n FROM study_fields")).rows[0].n);

it("reads the committed CSV as the complete ISCED-F 2013 list, signed off line by line", () => {
  expect(csv.errors).toEqual([]);
  expect(csv.rows).toHaveLength(219);
  expect(csv.rows.filter((r) => r.level === 3)).toHaveLength(149);
  expect(csv.rows.find((r) => r.code === "0613")?.name_en).toBe("Software and applications development and analysis");
  // Owner checked every line against the PDF on 2026-10-07 (docs/data/isced-f-2013.md).
  expect(csv.rows.every((r) => r.verified_by !== "" && /^\d{4}-\d{2}-\d{2}$/.test(r.verified_on))).toBe(true);
});
it("refuses unverified, inconsistent or orphan rows and writes nothing", async () => {
  await expect(importRows(csv.rows.map((r) => ({ ...r, verified_by: "" })))).rejects.toThrow("taxonomy_unverified");
  await expect(importRows(verified, "33333333-3333-4333-8333-333333333333")).rejects.toThrow("taxonomy_document_missing");
  const bad = (change: Record<string, unknown>) => verified.map((r) => (r.code === "0613" ? { ...r, ...change } : r));
  await expect(importRows(bad({ parent_code: "062" }))).rejects.toThrow("taxonomy_invalid");
  await expect(importRows(bad({ level: 2 }))).rejects.toThrow("taxonomy_invalid");
  await expect(importRows(bad({ verified_on: "2999-01-01" }))).rejects.toThrow("taxonomy_unverified");
  await expect(importRows([...verified, verified[0]])).rejects.toThrow("taxonomy_duplicate_code");
  await expect(importRows(verified.filter((r) => r.code !== "061"))).rejects.toThrow("taxonomy_parent_missing");
  expect(await count()).toBe(0);
});
it("is an operator action only: no API role may run the import", async () => {
  await expect(as(admin, () => importRows(verified))).rejects.toThrow(/permission denied/);
  await expect(as(null, () => importRows(verified))).rejects.toThrow(/permission denied/);
});
it("imports the tree once, skips identical rows, and never overwrites a name", async () => {
  expect((await importRows(verified)).rows[0].r).toEqual({ inserted: 219, unchanged: 0 });
  expect((await importRows(verified)).rows[0].r).toEqual({ inserted: 0, unchanged: 219 });
  const renamed = verified.map((r) => (r.code === "0613" ? { ...r, name_vi: "Tên khác" } : r));
  await expect(importRows(renamed)).rejects.toThrow("taxonomy_conflict");
  const tree = (await db.query<{ code: string; parent: string | null }>("SELECT f.code, p.code AS parent FROM study_fields f LEFT JOIN study_fields p ON p.id=f.parent_id WHERE f.code IN ('06','061','0613')")).rows;
  expect(Object.fromEntries(tree.map((r) => [r.code, r.parent]))).toEqual({ "06": null, "061": "06", "0613": "061" });
  expect((await db.query("SELECT * FROM access_audit WHERE action='study_fields.imported'")).rows).toHaveLength(2);
});
it("lets everyone read fields and nobody write them through the API", async () => {
  expect((await as(null, () => db.query("SELECT code FROM study_fields"))).rows).toHaveLength(219);
  await expect(as(admin, () => db.query("UPDATE study_fields SET name_en='x'"))).rejects.toThrow(/permission denied/);
  await expect(as(admin, () => db.query("DELETE FROM study_fields"))).rejects.toThrow(/permission denied/);
});

const save = (id: string | null, fields: Partial<Record<"key" | "definition_en" | "name_en" | "include", string>> & { keywords?: string[]; active?: boolean } = {}) =>
  db.query<{ id: string }>("SELECT save_career_path($1,$2,'Quản lý sản phẩm CNTT',$3,'Định nghĩa',$4,$5,null,$6,$7) AS id",
    [id, fields.key ?? "it_product_management", fields.name_en ?? "IT product management", fields.definition_en ?? "Definition",
      fields.include ?? "Must state product management", fields.keywords ?? ["product management", " Product Management ", "agile", ""], fields.active ?? true]);
let path: string;
it("requires taxonomy.manage, which complete administrators received", async () => {
  await expect(as(member, () => save(null))).rejects.toThrow("taxonomy_forbidden");
  await expect(as(null, () => save(null))).rejects.toThrow(/permission denied/);
  await expect(as(admin, () => save(null, { key: "Bad Key" }))).rejects.toThrow("taxonomy_invalid");
  await expect(as(admin, () => save(null, { name_en: "  " }))).rejects.toThrow("taxonomy_invalid");
  path = (await as(admin, () => save(null))).rows[0].id;
  await expect(as(admin, () => save(null))).rejects.toThrow("taxonomy_duplicate");
  const row = (await db.query<{ keywords: string[]; version: number }>("SELECT keywords,version FROM career_paths WHERE id=$1", [path])).rows[0];
  // Trimmed and de-duplicated without regard to case; empty entries dropped.
  expect(row.keywords).toHaveLength(2);
  expect(row.version).toBe(1);
});
it("versions criteria changes, keeps old versions, and keeps the key fixed", async () => {
  await as(admin, () => save(path, { name_en: "IT product & project management" }));
  expect((await db.query<{ version: number }>("SELECT version FROM career_paths WHERE id=$1", [path])).rows[0].version).toBe(1);
  await as(admin, () => save(path, { include: "Must state product or project management in IT" }));
  expect((await db.query<{ version: number }>("SELECT version FROM career_paths WHERE id=$1", [path])).rows[0].version).toBe(2);
  const versions = (await db.query<{ version: number; include_rule: string }>("SELECT version,include_rule FROM career_path_versions WHERE career_path_id=$1 ORDER BY version", [path])).rows;
  expect(versions.map((v) => [v.version, v.include_rule])).toEqual([[1, "Must state product management"], [2, "Must state product or project management in IT"]]);
  await expect(as(admin, () => save(path, { key: "renamed" }))).rejects.toThrow("taxonomy_immutable");
  expect((await db.query("SELECT * FROM access_audit WHERE action='career_path.saved'")).rows).toHaveLength(3);
});
it("shows active career paths to everyone, retired ones and history only to editors", async () => {
  expect((await as(null, () => db.query("SELECT id FROM career_paths"))).rows).toHaveLength(1);
  await as(admin, () => save(path, { include: "Must state product or project management in IT", active: false }));
  expect((await as(null, () => db.query("SELECT id FROM career_paths"))).rows).toHaveLength(0);
  expect((await as(member, () => db.query("SELECT id FROM career_paths"))).rows).toHaveLength(0);
  expect((await as(admin, () => db.query("SELECT id FROM career_paths"))).rows).toHaveLength(1);
  expect((await as(member, () => db.query("SELECT id FROM career_path_versions"))).rows).toHaveLength(0);
  await expect(as(null, () => db.query("SELECT id FROM career_path_versions"))).rejects.toThrow(/permission denied/);
  await expect(as(admin, () => db.query("UPDATE career_paths SET key='x'"))).rejects.toThrow(/permission denied/);
});
