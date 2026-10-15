import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

// PR 0 (configurable extraction audit, 2026-10-15): the hand-written SQL
// migrations are the source of truth; schema.prisma must describe the same
// tables and columns. It drifted after L4 (fact_type_changes, adjustments,
// render_js, evidence_history), which could make `prisma migrate dev` propose
// dropping them. This test applies every migration to a throwaway database and
// compares table and column names with the Prisma models.
const dir = "../../packages/db/prisma/migrations";
const db = new PGlite();

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for (const name of readdirSync(dir).filter((n) => /^\d{14}_/.test(n)).sort()) await db.exec(readFileSync(`${dir}/${name}/migration.sql`, "utf8"));
}, 60000);
afterAll(() => db.close());

/** Table → column names described by schema.prisma (relation fields skipped). */
function prismaColumns(schema: string) {
  const blocks = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)];
  const models = new Set(blocks.map((b) => b[1]));
  const tables = new Map<string, Set<string>>();
  for (const [, name, body] of blocks) {
    const table = body.match(/@@map\("([^"]+)"\)/)?.[1] ?? name;
    const columns = new Set<string>();
    for (const line of body.split("\n")) {
      const m = line.match(/^\s*(\w+)\s+([\w]+)(\(.*?\))?(\[\])?\??/);
      if (!m || line.trim().startsWith("//") || line.trim().startsWith("@@")) continue;
      if (models.has(m[2])) continue; // relation field, no column
      columns.add(line.match(/@map\("([^"]+)"\)/)?.[1] ?? m[1]);
    }
    tables.set(table, columns);
  }
  return tables;
}

it("describes every migrated table and column in schema.prisma, and nothing more", async () => {
  const described = prismaColumns(readFileSync("../../packages/db/prisma/schema.prisma", "utf8"));
  const rows = (await db.query<{ table_name: string; column_name: string }>(
    // Base tables only: views (e.g. document_structures_latest, PR 1) are read-only
    // definitions Prisma does not manage without a preview feature, and
    // `prisma migrate dev` never drops them; the risk this test guards is tables.
    `SELECT c.table_name, c.column_name FROM information_schema.columns c
     JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name AND t.table_type='BASE TABLE'
     WHERE c.table_schema='public' AND c.table_name NOT LIKE '\\_prisma%' ORDER BY 1, 2`)).rows;
  const actual = new Map<string, Set<string>>();
  for (const r of rows) (actual.get(r.table_name) ?? actual.set(r.table_name, new Set()).get(r.table_name)!).add(r.column_name);
  const problems: string[] = [];
  for (const [table, cols] of actual) {
    const model = described.get(table);
    if (!model) { problems.push(`table ${table} has no Prisma model`); continue; }
    for (const c of cols) if (!model.has(c)) problems.push(`${table}.${c} missing in schema.prisma`);
    for (const c of model) if (!cols.has(c)) problems.push(`${table}.${c} in schema.prisma but not in the migrations`);
  }
  for (const table of described.keys()) if (!actual.has(table)) problems.push(`model for ${table} but no such table`);
  expect(problems).toEqual([]);
});
