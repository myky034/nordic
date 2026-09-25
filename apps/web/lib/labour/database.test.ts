import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
// Synthetic rows in a disposable in-memory database only. No real occupation,
// salary or statistic is described here.
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
let sweden: string, denmark: string, statsSource: string, statsDoc: string, blogDoc: string;
let international: string, swedish: string;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for (const name of ["20260917090000_countries_sources", "20260918090000_documents", "20260918100000_rbac", "20260919090000_facts",
    "20260919100000_sources_manage", "20260923090000_fact_conflict_requires_review", "20260923100000_education",
    "20260923120000_immigration", "20260925090000_labour_market"]) {
    await db.exec(readFileSync(`../../packages/db/prisma/migrations/${name}/migration.sql`, "utf8"));
  }
  for (const id of [admin, member]) await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await db.query("SELECT bootstrap_administrator($1)", [admin]);
  sweden = (await db.query<{ id: string }>("SELECT id FROM countries WHERE slug='sweden'")).rows[0].id;
  denmark = (await db.query<{ id: string }>("SELECT id FROM countries WHERE slug='denmark'")).rows[0].id;
  const source = async (url: string, tier: string) => (await db.query<{ id: string }>(
    "INSERT INTO sources(name,canonical_url,source_tier,country_id) VALUES('Synthetic',$1,$2,$3) RETURNING id", [url, tier, sweden])).rows[0].id;
  const doc = async (sourceId: string, url: string) => (await db.query<{ id: string }>(`INSERT INTO documents(source_id,canonical_url,content_hash,metadata_hash,retrieved_at,ingestion_method)
    VALUES($1,$2,repeat('a',64),repeat('b',64),now(),'manual') RETURNING id`, [sourceId, url])).rows[0].id;
  statsSource = await source("https://stats.example.test/", "T1");
  statsDoc = await doc(statsSource, "https://stats.example.test/table");
  blogDoc = await doc(await source("https://blog.example.test/", "T4"), "https://blog.example.test/post");
}, 30000);
afterAll(() => db.close());
async function as<T>(id: string | null, fn: () => Promise<T>) {
  if (id) await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`SET SESSION AUTHORIZATION ${id ? "authenticated" : "anon"}`);
  try { return await fn(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
const propose = (name: string, country: string | null, system: string | null = null, code: string | null = null) => db.query<{ id: string }>(
  "SELECT propose_occupation($1,$2,$3,$4,$5,'Synthetic excerpt naming the occupation.') AS id", [name, system, code, country, statsDoc]);
const figure = (doc: string, occupation: string, country: string | null, period: string | null = "2024") => as(admin, () => db.query<{ id: string }>(
  "SELECT propose_fact($1,'labour_market',$2,'synthetic metric','synthetic value','EUR',$3,null,null,'Synthetic excerpt',null,null,null,null,$4,$5) AS id",
  [doc, "Synthetic occupation", country, occupation, period]));
const setSource = (id: string, status: string) =>
  db.query("UPDATE sources SET status=$2, authority_notes='synthetic', last_verified_at=now() WHERE id=$1", [id, status]);

it("requires labour.manage to propose and facts.review to decide", async () => {
  await expect(as(member, () => propose("Synthetic analyst", null))).rejects.toThrow("labour_forbidden");
  await expect(as(null, () => propose("Synthetic analyst", null))).rejects.toThrow(/permission denied/);
  const grants = (await db.query<{ name: string }>("SELECT r.name FROM roles r JOIN role_permissions rp ON rp.role_id=r.id WHERE rp.permission_key='labour.manage'")).rows;
  expect(grants.map((g) => g.name)).toEqual(["Administrator"]);
});
it("records a classification code only together with its system, and deduplicates per scope", async () => {
  await as(admin, async () => {
    await expect(propose("Synthetic analyst", null, "ISCO-08", null)).rejects.toThrow("labour_invalid");
    await expect(propose("Synthetic analyst", null, "made-up", "1234")).rejects.toThrow("labour_invalid");
    international = (await propose("Synthetic analyst", null, "ISCO-08", "0000")).rows[0].id;
    await expect(propose("synthetic ANALYST", null)).rejects.toThrow("labour_duplicate");
    // The same name scoped to one country is a different entry.
    swedish = (await propose("Synthetic analyst", sweden)).rows[0].id;
  });
  await as(null, async () => { expect((await db.query("SELECT * FROM occupations")).rows).toHaveLength(0); });
  await as(admin, () => db.query("SELECT review_occupation($1,'reviewed','checked')", [international]));
  await as(null, async () => { expect((await db.query("SELECT * FROM occupations")).rows).toHaveLength(1); });
  await expect(as(admin, () => db.query("SELECT review_occupation($1,'rejected','again')", [international]))).rejects.toThrow("labour_already_decided");
});
it("requires a country and a well-formed reference period for occupation figures", async () => {
  await expect(figure(statsDoc, international, null)).rejects.toThrow("facts_country_required");
  for (const bad of ["recent", "2024-Q5", "24", "2024-13", "2024-1"]) await expect(figure(statsDoc, international, sweden, bad)).rejects.toThrow("facts_invalid");
  await expect(figure(statsDoc, swedish, denmark)).rejects.toThrow("facts_country_mismatch");
  const inherited = (await figure(statsDoc, swedish, null, "2025-Q2")).rows[0].id;
  expect((await db.query<{ country_id: string; reference_period: string }>("SELECT * FROM facts WHERE id=$1", [inherited])).rows[0])
    .toMatchObject({ country_id: sweden, reference_period: "2025-Q2" });
  await expect(as(admin, () => db.query("SELECT propose_fact($1,'t','s','p','v',null,$2,null,null,'e',null,null,null,null,$3,null)", [statsDoc, sweden, international]))).resolves.toBeDefined();
});
it("shows a figure only while its occupation is reviewed and its own source is verified", async () => {
  const official = (await figure(statsDoc, international, sweden)).rows[0].id;
  const community = (await figure(blogDoc, international, sweden)).rows[0].id;
  for (const id of [official, community]) await as(admin, () => db.query("SELECT review_fact($1,'reviewed','checked',null)", [id]));
  const visible = () => as(null, async () => (await db.query<{ id: string }>("SELECT id FROM facts WHERE occupation_id IS NOT NULL")).rows.map((r) => r.id));
  expect(await visible()).toEqual([]); // no source verified yet
  await setSource(statsSource, "verified");
  expect(await visible()).toEqual([official]); // T4 blog source still unverified
  const blog = (await db.query<{ source_id: string }>("SELECT source_id FROM documents WHERE id=$1", [blogDoc])).rows[0].source_id;
  await setSource(blog, "verified");
  expect((await visible()).sort()).toEqual([official, community].sort());
  await setSource(statsSource, "review_required");
  expect(await visible()).toEqual([community]);
});
it("keeps a figure hidden while its occupation is only proposed, and older callers working", async () => {
  await setSource(statsSource, "verified");
  const draft = (await figure(statsDoc, swedish, null)).rows[0].id;
  await as(admin, () => db.query("SELECT review_fact($1,'reviewed','checked',null)", [draft]));
  const ids = await as(null, async () => (await db.query<{ id: string }>("SELECT id FROM facts")).rows.map((r) => r.id));
  expect(ids).not.toContain(draft);
  await as(admin, () => db.query("SELECT propose_fact($1,'t','s','p','v',null,null,null,null,'e')", [statsDoc]));
  await expect(as(admin, () => db.query("SELECT propose_fact($1,'t','s','p','v',null,$2,null,null,'e',null,null,null,null,$3,null)", [statsDoc, sweden, "00000000-0000-4000-8000-000000000000"]))).rejects.toThrow("facts_invalid");
});
