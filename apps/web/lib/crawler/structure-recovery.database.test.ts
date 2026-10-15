import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

// PR 1 migration runbook (docs/architecture/pr1-migration-runbook.md): proves on
// a throwaway database that (1) the migration is atomic, (2) the prepared
// forward-fix removes only PR 1's objects and leaves existing data intact, and
// (3) PR 1 can be applied again afterwards.
const dir = "../../packages/db/prisma/migrations";
const pr1 = "20261016090000_document_structures";
const migrationSql = readFileSync(`${dir}/${pr1}/migration.sql`, "utf8");
const forwardFix = readFileSync(`../../packages/db/prisma/recovery/${pr1}.forward-fix.sql`, "utf8");
const db = new PGlite();
const exists = async (sql: string) => (await db.query<{ ok: boolean }>(sql)).rows[0].ok;
const pr1Objects = async () => ({
  table: await exists("SELECT to_regclass('public.document_structures') IS NOT NULL AS ok"),
  view: await exists("SELECT to_regclass('public.document_structures_latest') IS NOT NULL AS ok"),
  fn: await exists("SELECT to_regprocedure('public.crawler_record_structure(uuid,uuid,text,jsonb,timestamptz)') IS NOT NULL AS ok"),
});

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  // Everything up to (not including) PR 1, plus a document as "existing data".
  for (const name of readdirSync(dir).filter((n) => /^\d{14}_/.test(n) && n < pr1).sort()) await db.exec(readFileSync(`${dir}/${name}/migration.sql`, "utf8"));
  const source = (await db.query<{ id: string }>("INSERT INTO sources(name,canonical_url,source_tier) VALUES('Synthetic','https://s.example.test/','T2') RETURNING id")).rows[0].id;
  await db.query(`INSERT INTO documents(source_id,canonical_url,title,content_hash,hash_method,metadata_hash,retrieved_at,ingestion_method)
    VALUES($1,'https://s.example.test/p','Existing',repeat('a',64),'sha256-text-v1',repeat('b',64),now(),'crawler')`, [source]);
}, 60000);
afterAll(() => db.close());

it("is atomic: a failure inside the migration leaves nothing behind", async () => {
  // Simulate a failure on the last statement before COMMIT.
  const broken = migrationSql.replace("NOTIFY pgrst, 'reload schema';\nCOMMIT;", "SELECT 1/0;\nCOMMIT;");
  expect(broken).not.toBe(migrationSql);
  await expect(db.exec(broken)).rejects.toThrow(/division by zero/);
  await db.exec("ROLLBACK");
  expect(await pr1Objects()).toEqual({ table: false, view: false, fn: false });
});
it("applies, is removed by the prepared forward-fix without touching existing data, and applies again", async () => {
  await db.exec(migrationSql);
  expect(await pr1Objects()).toEqual({ table: true, view: true, fn: true });
  await db.exec(forwardFix);
  expect(await pr1Objects()).toEqual({ table: false, view: false, fn: false });
  expect((await db.query("SELECT title FROM documents")).rows).toEqual([{ title: "Existing" }]);
  expect(await exists("SELECT to_regprocedure('public.crawler_record(uuid,uuid,text,integer,text,text,integer,text,text,text,text,text,text,timestamptz)') IS NOT NULL AS ok")).toBe(true);
  await db.exec(migrationSql);
  expect(await pr1Objects()).toEqual({ table: true, view: true, fn: true });
});
