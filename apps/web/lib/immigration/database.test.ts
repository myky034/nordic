import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
// Synthetic rows in a disposable in-memory database only. No real authority,
// rule or requirement is described here.
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
let sweden: string, denmark: string, t1Source: string, t1Doc: string, t3Doc: string, otherCountryDoc: string, rule: string;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for (const name of ["20260917090000_countries_sources", "20260918090000_documents", "20260918100000_rbac", "20260919090000_facts",
    "20260919100000_sources_manage", "20260923090000_fact_conflict_requires_review", "20260923100000_education", "20260923120000_immigration"]) {
    await db.exec(readFileSync(`../../packages/db/prisma/migrations/${name}/migration.sql`, "utf8"));
  }
  for (const id of [admin, member]) await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await db.query("SELECT bootstrap_administrator($1)", [admin]);
  sweden = (await db.query<{ id: string }>("SELECT id FROM countries WHERE slug='sweden'")).rows[0].id;
  denmark = (await db.query<{ id: string }>("SELECT id FROM countries WHERE slug='denmark'")).rows[0].id;
  const source = async (url: string, tier: string, country: string) => (await db.query<{ id: string }>(
    "INSERT INTO sources(name,canonical_url,source_tier,country_id) VALUES('Synthetic',$1,$2,$3) RETURNING id", [url, tier, country])).rows[0].id;
  const doc = async (sourceId: string, url: string) => (await db.query<{ id: string }>(`INSERT INTO documents(source_id,canonical_url,content_hash,metadata_hash,retrieved_at,ingestion_method)
    VALUES($1,$2,repeat('a',64),repeat('b',64),now(),'manual') RETURNING id`, [sourceId, url])).rows[0].id;
  t1Source = await source("https://authority.example.test/", "T1", sweden);
  t1Doc = await doc(t1Source, "https://authority.example.test/permits/study");
  t3Doc = await doc(await source("https://blog.example.test/", "T3", sweden), "https://blog.example.test/post");
  otherCountryDoc = await doc(await source("https://other-authority.example.test/", "T1", denmark), "https://other-authority.example.test/p");
}, 30000);
afterAll(() => db.close());
async function as<T>(id: string | null, fn: () => Promise<T>) {
  if (id) await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`SET SESSION AUTHORIZATION ${id ? "authenticated" : "anon"}`);
  try { return await fn(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
const propose = (doc: string, overrides: { country?: string; url?: string; title?: string } = {}) => db.query<{ id: string }>(
  "SELECT propose_immigration_rule($1,'student_residence_permit',$2,$3,$4,'Synthetic excerpt naming the permit.') AS id",
  [overrides.country ?? sweden, overrides.title ?? "Synthetic study permit", overrides.url ?? "https://authority.example.test/permits/study", doc]);
const review = (id: string, decision = "reviewed") => db.query("SELECT review_immigration_rule($1,$2,'Checked synthetic evidence')", [id, decision]);
const setSource = (id: string, status: string, tier = "T1") =>
  db.query("UPDATE sources SET status=$2, source_tier=$3, authority_notes='synthetic', last_verified_at=now() WHERE id=$1", [id, status, tier]);
const publicRules = () => as(null, async () => (await db.query("SELECT * FROM immigration_rules")).rows.length);

it("requires immigration.manage to propose and facts.review to decide", async () => {
  await expect(as(member, () => propose(t1Doc))).rejects.toThrow("immigration_forbidden");
  await expect(as(null, () => propose(t1Doc))).rejects.toThrow(/permission denied/);
  const grants = (await db.query<{ name: string }>("SELECT r.name FROM roles r JOIN role_permissions rp ON rp.role_id=r.id WHERE rp.permission_key='immigration.manage'")).rows;
  expect(grants.map((g) => g.name)).toEqual(["Administrator"]);
});
it("only accepts a T1 document from the same country, with the official page on the authority's site", async () => {
  await as(admin, async () => {
    await expect(propose(t3Doc)).rejects.toThrow("immigration_requires_t1");
    await expect(propose(otherCountryDoc)).rejects.toThrow("immigration_source_country_mismatch");
    await expect(propose(t1Doc, { url: "https://lookalike.example.test/permits" })).rejects.toThrow("immigration_url_not_authority");
    // Host comparison is case-insensitive (hosts are case-insensitive in URLs).
    rule = (await propose(t1Doc, { url: "https://Authority.example.test/permits/study" })).rows[0].id;
    await expect(propose(t1Doc, { title: "synthetic STUDY permit" })).rejects.toThrow("immigration_duplicate");
  });
});
it("stays private until reviewed AND its T1 source is registry-verified", async () => {
  expect(await publicRules()).toBe(0);
  await as(admin, () => review(rule));
  expect(await publicRules()).toBe(0); // source still needs_verification
  await setSource(t1Source, "verified");
  expect(await publicRules()).toBe(1);
  await setSource(t1Source, "review_required");
  expect(await publicRules()).toBe(0); // un-verifying hides it again immediately
  await setSource(t1Source, "verified", "T2");
  expect(await publicRules()).toBe(0); // downgraded tier hides it too
  await setSource(t1Source, "verified");
  await expect(as(admin, () => review(rule, "rejected"))).rejects.toThrow("immigration_already_decided");
  await as(null, async () => { await expect(db.query("SELECT * FROM immigration_rule_reviews")).rejects.toThrow(/permission denied/); });
});
it("links requirement facts, inherits the country, and hides facts whose own source is unverified", async () => {
  const propose14 = (doc: string, country: string | null = null) => as(admin, () => db.query<{ id: string }>(
    "SELECT propose_fact($1,'immigration','Synthetic permit','financial requirement','synthetic value',null,$2,null,null,'Synthetic excerpt',null,null,null,$3) AS id",
    [doc, country, rule]));
  const fromT1 = (await propose14(t1Doc)).rows[0].id;
  const fromT3 = (await propose14(t3Doc)).rows[0].id;
  await expect(propose14(t1Doc, denmark)).rejects.toThrow("facts_country_mismatch");
  expect((await db.query<{ country_id: string }>("SELECT country_id FROM facts WHERE id=$1", [fromT1])).rows[0].country_id).toBe(sweden);
  for (const id of [fromT1, fromT3]) await as(admin, () => db.query("SELECT review_fact($1,'reviewed','checked',null)", [id]));
  const visible = () => as(null, async () => (await db.query<{ id: string }>("SELECT id FROM facts")).rows.map((r) => r.id));
  // The T3 blog source is not verified: its fact stays hidden even though reviewed.
  expect(await visible()).toEqual([fromT1]);
  const blog = (await db.query<{ source_id: string }>("SELECT source_id FROM documents WHERE id=$1", [t3Doc])).rows[0].source_id;
  await setSource(blog, "verified", "T3");
  expect((await visible()).sort()).toEqual([fromT1, fromT3].sort());
  // Hiding the rule's authority hides every linked fact.
  await setSource(t1Source, "needs_verification");
  expect(await visible()).toEqual([]);
  await setSource(t1Source, "verified");
});
it("refuses linking a fact to more than one entity and keeps older callers working", async () => {
  await expect(as(admin, () => db.query("SELECT propose_fact($1,'t','s','p','v',null,null,null,null,'e',$2,null,null,$2)", [t1Doc, rule]))).rejects.toThrow();
  await as(admin, () => db.query("SELECT propose_fact($1,'t','s','p','v',null,null,null,null,'e')", [t1Doc]));
});
it("re-checks the T1 tier at review time", async () => {
  const late = (await as(admin, () => propose(t1Doc, { title: "Synthetic work permit" }))).rows[0].id;
  await setSource(t1Source, "verified", "T2");
  await expect(as(admin, () => review(late))).rejects.toThrow("immigration_requires_t1");
  await setSource(t1Source, "verified");
});
