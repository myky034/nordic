import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
// Synthetic rows in a disposable in-memory database only.
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
let sweden: string, doc: string, metric: string;
const dir = "../../packages/db/prisma/migrations";
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  // Every migration, in order: search and metrics depend on all earlier tables.
  for (const name of readdirSync(dir).filter((n) => /^\d{14}_/.test(n)).sort()) {
    await db.exec(readFileSync(`${dir}/${name}/migration.sql`, "utf8"));
  }
  for (const id of [admin, member]) await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await db.query("SELECT bootstrap_administrator($1)", [admin]);
  sweden = (await db.query<{ id: string }>("SELECT id FROM countries WHERE slug='sweden'")).rows[0].id;
  const source = (await db.query<{ id: string }>("INSERT INTO sources(name,canonical_url,source_tier,country_id) VALUES('Synthetic Malmö office','https://office.example.test/','T1',$1) RETURNING id", [sweden])).rows[0].id;
  doc = (await db.query<{ id: string }>(`INSERT INTO documents(source_id,canonical_url,title,content_hash,metadata_hash,retrieved_at,ingestion_method)
    VALUES($1,'https://office.example.test/a','Synthetic Göteborg guide',repeat('a',64),repeat('b',64),now(),'manual') RETURNING id`, [source])).rows[0].id;
}, 60000);
afterAll(() => db.close());
async function as<T>(id: string | null, fn: () => Promise<T>) {
  if (id) await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`SET SESSION AUTHORIZATION ${id ? "authenticated" : "anon"}`);
  try { return await fn(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
const search = (q: string) => as(null, async () => (await db.query<{ entity_type: string; title: string; total: string }>("SELECT * FROM search_public($1,5)", [q])).rows);

it("folds accents and case so plain ASCII queries find Nordic names", async () => {
  expect((await db.query<{ f: string }>("SELECT search_fold('Malmö ÅRHUS Tromsø Straße Æble') AS f")).rows[0].f).toBe("malmo arhus tromso strase able");
  const hits = await search("malmo");
  expect(hits.map((h) => [h.entity_type, h.title])).toContainEqual(["source", "Synthetic Malmö office"]);
  expect((await search("goteborg")).map((h) => h.entity_type)).toContain("document");
  expect((await search("SWEDEN")).map((h) => h.entity_type)).toContain("country");
});
it("returns only public rows: drafts never appear in search", async () => {
  await as(admin, () => db.query("SELECT propose_university($1,'Synthetic Uppsala college','https://college.example.test/',$2,'Synthetic excerpt')", [sweden, doc]));
  expect((await search("uppsala")).length).toBe(0);
  const id = (await db.query<{ id: string }>("SELECT id FROM universities")).rows[0].id;
  await as(admin, () => db.query("SELECT review_education('university',$1,'reviewed','checked')", [id]));
  expect((await search("uppsala")).map((h) => h.entity_type)).toEqual(["university"]);
});
it("tolerates arbitrary user input and caps results per type", async () => {
  for (const q of ["", "   ", "\"unterminated", "a OR -b", "'); DROP TABLE facts; --", "x".repeat(5000)]) await expect(search(q)).resolves.toBeDefined();
  const capped = await as(null, async () => (await db.query("SELECT * FROM search_public('synthetic', 999)")).rows);
  expect(capped.length).toBeLessThanOrEqual(20 * 8);
});
it("requires metrics.manage to define metrics and keeps key/category immutable", async () => {
  const save = (id: string | null, key: string, category = "living_cost", active = true) =>
    db.query<{ id: string }>("SELECT save_metric($1,$2,'Synthetic metric','What exactly is measured','EUR/month',$3,$4) AS id", [id, key, category, active]);
  await expect(as(member, () => save(null, "synthetic_cost"))).rejects.toThrow("metrics_forbidden");
  await expect(as(null, () => save(null, "synthetic_cost"))).rejects.toThrow(/permission denied/);
  await expect(as(admin, () => save(null, "Bad Key!"))).rejects.toThrow("metrics_invalid");
  await expect(as(admin, () => save(null, "synthetic_cost", "happiness"))).rejects.toThrow("metrics_invalid");
  metric = (await as(admin, () => save(null, "synthetic_cost"))).rows[0].id;
  await expect(as(admin, () => save(null, "synthetic_cost"))).rejects.toThrow("metrics_duplicate");
  await expect(as(admin, () => save(metric, "renamed_key"))).rejects.toThrow("metrics_immutable");
  await expect(as(admin, () => save(metric, "synthetic_cost", "tuition"))).rejects.toThrow("metrics_immutable");
  await as(admin, () => save(metric, "synthetic_cost")); // label/description edits are allowed
  expect((await db.query("SELECT * FROM access_audit WHERE action='metric.saved'")).rows).toHaveLength(2);
  expect((await as(null, async () => (await db.query("SELECT * FROM comparison_metrics")).rows)).length).toBe(1);
});
it("links facts to active metrics only, and requires a country", async () => {
  const propose = (country: string | null, m = metric) => as(admin, () => db.query(
    "SELECT propose_fact($1,'living_cost','Synthetic','monthly cost','1','EUR',$2,null,null,'e',null,null,null,null,null,'2024',$3)", [doc, country, m]));
  await expect(propose(null)).rejects.toThrow("facts_country_required");
  await propose(sweden);
  await db.query("UPDATE comparison_metrics SET active=false WHERE id=$1", [metric]);
  await expect(propose(sweden)).rejects.toThrow("facts_invalid");
  expect((await db.query("SELECT * FROM facts WHERE metric_id IS NOT NULL")).rows).toHaveLength(1);
});
