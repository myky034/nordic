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
// L3a (2026-10-13): comparison metrics became fact types; a metric is a
// fact type with comparable = true.
const saveType = (id: string | null, o: { key?: string; kind?: string; applies?: string; category?: string; min?: number | null; max?: number | null; labelEn?: string; comparable?: boolean; active?: boolean } = {}) =>
  db.query<{ id: string }>("SELECT save_fact_type($1,$2,'Chi phí sinh hoạt giả',$3,'Đo gì','What exactly is measured',$4,$5,$6,'EUR/month',$7,$8,$9,$10) AS id",
    [id, o.key ?? "synthetic_cost", o.labelEn ?? "Synthetic living cost", o.kind ?? "money", o.applies ?? "country", o.category ?? "living_cost",
     o.min ?? null, o.max ?? null, o.comparable ?? true, o.active ?? true]);
it("requires metrics.manage to define fact types and keeps key, kind, entity and category fixed", async () => {
  await expect(as(member, () => saveType(null))).rejects.toThrow("fact_types_forbidden");
  await expect(as(null, () => saveType(null))).rejects.toThrow(/permission denied/);
  await expect(as(admin, () => saveType(null, { key: "Bad Key!" }))).rejects.toThrow("fact_types_invalid");
  await expect(as(admin, () => saveType(null, { category: "happiness" }))).rejects.toThrow("fact_types_invalid");
  await expect(as(admin, () => saveType(null, { kind: "colour" }))).rejects.toThrow("fact_types_invalid");
  await expect(as(admin, () => saveType(null, { labelEn: "  " }))).rejects.toThrow("fact_types_invalid"); // both languages required
  await expect(as(admin, () => saveType(null, { min: 0, max: 9 }))).rejects.toThrow("fact_types_invalid"); // range only for numbers
  metric = (await as(admin, () => saveType(null))).rows[0].id;
  await expect(as(admin, () => saveType(null))).rejects.toThrow("fact_types_duplicate");
  await expect(as(admin, () => saveType(metric, { key: "renamed_key" }))).rejects.toThrow("fact_types_immutable");
  await expect(as(admin, () => saveType(metric, { category: "tuition" }))).rejects.toThrow("fact_types_immutable");
  await expect(as(admin, () => saveType(metric, { kind: "number" }))).rejects.toThrow("fact_types_immutable");
  await expect(as(admin, () => saveType(metric, { applies: "programme" }))).rejects.toThrow("fact_types_immutable");
  await as(admin, () => saveType(metric, { labelEn: "Synthetic monthly cost" })); // labels may be clarified
  expect((await db.query("SELECT * FROM access_audit WHERE action='fact_type.saved'")).rows).toHaveLength(2);
  expect((await as(null, async () => (await db.query("SELECT label_en, comparable FROM fact_types")).rows))).toEqual([{ label_en: "Synthetic monthly cost", comparable: true }]);
});
it("checks a typed fact's structured value, entity and excerpt; untyped facts stay as before", async () => {
  const propose = (o: { country?: string | null; type?: string | null; num?: number | null; cur?: string | null; per?: string | null; date?: string | null; excerpt?: string; value?: string; programme?: string | null } = {}) =>
    as(admin, () => db.query(
      "SELECT propose_fact($1,'living_cost','Synthetic','monthly cost',$2,'SEK',$3,null,null,$4,null,$5,null,null,null,'2024',$6,$7,$8,$9,$10)",
      [doc, o.value ?? "SEK 12 300 per month", o.country === undefined ? sweden : o.country, o.excerpt ?? "Students need SEK 12 300 per month.", o.programme ?? null,
       o.type === undefined ? metric : o.type, o.num === undefined ? 12300 : o.num, o.cur === undefined ? "SEK" : o.cur, o.per === undefined ? "month" : o.per, o.date ?? null]));
  await expect(propose({ country: null })).rejects.toThrow("facts_country_required");
  await expect(propose({ cur: null })).rejects.toThrow("facts_type_value_invalid");
  await expect(propose({ per: null })).rejects.toThrow("facts_type_value_invalid");
  await expect(propose({ cur: "sek" })).rejects.toThrow(/check constraint|facts_invalid|facts_type_value_invalid/);
  await expect(propose({ date: "2027-01-15" })).rejects.toThrow("facts_type_value_invalid");
  // The structured number must be in the excerpt (digit groups may differ).
  await expect(propose({ num: 13200 })).rejects.toThrow("facts_number_not_in_excerpt");
  // Structured values without a type are refused.
  await expect(propose({ type: null })).rejects.toThrow("facts_invalid");
  await propose();
  // L4 Q1: a typed fact may have no structured value at all ("about SEK 12 300"
  // read by a reviewer later), but never half of one (checked above).
  await propose({ num: null, cur: null, per: null, value: "around SEK 12 300 per month" });
  // Untyped facts are unchanged.
  await propose({ type: null, num: null, cur: null, per: null });
  await db.query("UPDATE fact_types SET active=false WHERE id=$1", [metric]);
  await expect(propose()).rejects.toThrow("facts_type_invalid");
  const rows = (await db.query<{ value: string; value_number: string; value_currency: string; value_period: string }>("SELECT value,value_number,value_currency,value_period FROM facts WHERE fact_type_id IS NOT NULL ORDER BY created_at")).rows;
  expect(rows).toEqual([{ value: "SEK 12 300 per month", value_number: "12300", value_currency: "SEK", value_period: "month" },
    { value: "around SEK 12 300 per month", value_number: null, value_currency: null, value_period: null }]);
});
it("matches the type's entity and number range, and finds decimals and years in the excerpt", async () => {
  const ielts = (await as(admin, () => saveType(null, { key: "min_ielts_overall", kind: "number", applies: "programme", category: "language", min: 0, max: 9, comparable: false }))).rows[0].id;
  const deadline = (await as(admin, () => saveType(null, { key: "application_deadline", kind: "date", applies: "programme", category: "education", comparable: false }))).rows[0].id;
  const uni = (await as(admin, () => db.query<{ id: string }>("SELECT propose_university($1,'Synthetic University','https://uni.example.test/',$2,'Synthetic excerpt') AS id", [sweden, doc]))).rows[0].id;
  const programme = (await as(admin, () => db.query<{ id: string }>("SELECT propose_programme($1,'MSc Synthetic','master',null,'English','https://uni.example.test/p','',$2,'Synthetic excerpt') AS id", [uni, doc]))).rows[0].id;
  const typed = (type: string, num: number | null, date: string | null, excerpt: string, prog: string | null = programme) => as(admin, () => db.query(
    "SELECT propose_fact($1,'language','MSc Synthetic','minimum IELTS',$2,null,null,null,null,$3,null,$4,null,null,null,null,$5,$6,null,null,$7)",
    [doc, String(num ?? date), excerpt, prog, type, num, date]));
  await expect(typed(ielts, 6.5, null, "IELTS 6.5 overall", null)).rejects.toThrow("facts_type_entity_mismatch");
  await expect(typed(ielts, 10, null, "IELTS 10 overall")).rejects.toThrow("facts_type_value_invalid");
  await typed(ielts, 6.5, null, "An overall IELTS score of 6,5 is required.");
  await expect(typed(deadline, null, "2027-01-15", "Apply by 15 January 2026.")).rejects.toThrow("facts_number_not_in_excerpt");
  await typed(deadline, null, "2027-01-15", "Apply by 15 January 2027.");
});
