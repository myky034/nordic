import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
// Synthetic universities, programmes, documents and taxonomy rows in a
// disposable in-memory database only (AGENTS.md §1.1).
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
const proposer = "22222222-2222-4222-8222-222222222222"; // education.manage only
const dir = "../../packages/db/prisma/migrations";
const ids: Record<string, string> = {};
const one = async (sql: string, params: unknown[] = []) => (await db.query<{ id: string }>(sql, params)).rows[0].id;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for (const name of readdirSync(dir).filter((n) => /^\d{14}_/.test(n)).sort()) await db.exec(readFileSync(`${dir}/${name}/migration.sql`, "utf8"));
  for (const id of [admin, proposer]) await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await db.query("SELECT bootstrap_administrator($1)", [admin]);
  const role = await one("INSERT INTO roles(name,description) VALUES('Synthetic proposer','') RETURNING id");
  await db.query("INSERT INTO role_permissions(role_id,permission_key) VALUES($1,'education.manage')", [role]);
  await db.query("INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)", [proposer, role]);
  const sweden = await one("SELECT id FROM countries WHERE slug='sweden'");
  const source = await one("INSERT INTO sources(name,canonical_url,source_tier,country_id) VALUES('Synthetic university','https://uni.example.test/','T2',$1) RETURNING id", [sweden]);
  const doc = (url: string, n: string) => one(`INSERT INTO documents(source_id,canonical_url,title,content_hash,metadata_hash,retrieved_at,ingestion_method)
    VALUES($1,$2,'Synthetic page',repeat($3,64),repeat($3,64),now(),'manual') RETURNING id`, [source, url, n]);
  ids.doc = await doc("https://education.uni.example.test/msc-software", "a");
  ids.elsewhere = await doc("https://aggregator.example.test/msc-software", "b");
  await as(admin, async () => {
    ids.uni = await one("SELECT propose_university($1,'Synthetic University','https://www.uni.example.test/',$2,'Synthetic excerpt') AS id", [sweden, ids.doc]);
    await db.query("SELECT review_education('university',$1,'reviewed','ok')", [ids.uni]);
    const programme = (name: string, degree: string) => one("SELECT propose_programme($1,$2,$3,null,'English','https://www.uni.example.test/p','',$4,'Synthetic excerpt') AS id", [ids.uni, name, degree, ids.doc]);
    ids.master = await programme("MSc Synthetic Software", "master");
    ids.bachelor = await programme("BSc Synthetic Software", "bachelor");
    ids.draft = await programme("MSc Synthetic Draft", "master");
    for (const p of [ids.master, ids.bachelor]) await db.query("SELECT review_education('programme',$1,'reviewed','ok')", [p]);
    ids.path = await one("SELECT save_career_path(null,'synthetic_path','Hướng nghề giả','Synthetic path','Định nghĩa','Definition','Rule v1',null,'{}',true) AS id");
    ids.retired = await one("SELECT save_career_path(null,'retired_path','Đã ngừng','Retired','Định nghĩa','Definition','Rule',null,'{}',false) AS id");
  });
  const rows = [["06", "", "ICT"], ["061", "06", "ICT"], ["0613", "061", "Software"], ["99", "", "Field unknown"], ["999", "99", "Field unknown"], ["9999", "999", "Field unknown"]]
    .map(([code, parent, name]) => ({ code, level: code.length - 1, parent_code: parent, name_en: name, name_vi: name, source_page: 56, verified_by: "Synthetic", verified_on: "2026-10-07" }));
  await db.query("SELECT import_study_fields($1,$2::jsonb)", [ids.doc, JSON.stringify(rows)]);
  ids.software = await one("SELECT id FROM study_fields WHERE code='0613'");
  ids.unknown = await one("SELECT id FROM study_fields WHERE code='9999'");
}, 60000);
afterAll(() => db.close());
async function as<T>(id: string | null, fn: () => Promise<T>) {
  if (id) await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`SET SESSION AUTHORIZATION ${id ? "authenticated" : "anon"}`);
  try { return await fn(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
const propose = (who: string | null, o: { programme?: string; field?: string | null; path?: string | null; doc?: string; excerpt?: string } = {}) =>
  as(who, () => one("SELECT propose_classification($1,$2,$3,$4,$5) AS id",
    [o.programme ?? ids.master, o.field === undefined ? ids.software : o.field, o.path ?? null, o.doc ?? ids.doc, o.excerpt ?? "Main field: software engineering"]));
const review = (who: string, id: string, decision: string, note = "Checked against the page") =>
  as(who, () => db.query("SELECT review_classification($1,$2,$3)", [id, decision, note]));
const publicRows = () => as(null, async () => (await db.query("SELECT id FROM programme_classifications")).rows);

it("refuses proposals that break the rules", async () => {
  await expect(propose(null)).rejects.toThrow(/permission denied/);
  await expect(propose(proposer, { programme: ids.bachelor })).rejects.toThrow("classification_programme_ineligible");
  await expect(propose(proposer, { programme: ids.draft })).rejects.toThrow("classification_programme_ineligible");
  await expect(propose(proposer, { path: ids.path })).rejects.toThrow("classification_invalid"); // both targets
  await expect(propose(proposer, { field: null })).rejects.toThrow("classification_invalid"); // no target
  await expect(propose(proposer, { field: ids.unknown })).rejects.toThrow("classification_invalid");
  await expect(propose(proposer, { field: null, path: ids.retired })).rejects.toThrow("classification_career_path_retired");
  await expect(propose(proposer, { doc: ids.elsewhere })).rejects.toThrow("classification_document_mismatch");
  await expect(propose(proposer, { excerpt: "x".repeat(501) })).rejects.toThrow("classification_invalid");
  expect((await db.query("SELECT * FROM programme_classifications")).rows).toHaveLength(0);
});
it("accepts evidence from a subdomain of the programme's site, once per target, and publishes only after review", async () => {
  ids.fieldClass = await propose(proposer);
  await expect(propose(proposer)).rejects.toThrow("classification_duplicate");
  ids.pathClass = await propose(proposer, { field: null, path: ids.path });
  expect(await publicRows()).toHaveLength(0);
  await expect(review(proposer, ids.fieldClass, "reviewed")).rejects.toThrow("classification_forbidden");
  await expect(review(admin, ids.fieldClass, "reviewed", " ")).rejects.toThrow("classification_invalid");
  await review(admin, ids.fieldClass, "reviewed");
  await review(admin, ids.pathClass, "reviewed");
  expect((await publicRows()).map((r) => (r as { id: string }).id).sort()).toEqual([ids.fieldClass, ids.pathClass].sort());
  await expect(review(admin, ids.fieldClass, "reviewed")).rejects.toThrow("classification_already_decided");
});
it("lists classifications for re-review when the career path's criteria change, without changing them silently", async () => {
  await expect(review(admin, ids.pathClass, "revalidated")).rejects.toThrow("classification_not_stale");
  await as(admin, () => db.query("SELECT save_career_path($1,'synthetic_path','Hướng nghề giả','Synthetic path','Định nghĩa','Definition','Rule v2',null,'{}',true)", [ids.path]));
  const stale = await db.query<{ career_path_version: number; current: number }>(
    "SELECT c.career_path_version, p.version AS current FROM programme_classifications c JOIN career_paths p ON p.id=c.career_path_id WHERE c.id=$1", [ids.pathClass]);
  expect(stale.rows[0]).toEqual({ career_path_version: 1, current: 2 });
  await review(admin, ids.pathClass, "revalidated", "Still matches rule v2");
  expect((await db.query<{ v: number }>("SELECT career_path_version AS v FROM programme_classifications WHERE id=$1", [ids.pathClass])).rows[0].v).toBe(2);
  const log = (await db.query<{ decision: string; career_path_version: number | null }>("SELECT decision,career_path_version FROM classification_reviews WHERE classification_id=$1 ORDER BY created_at", [ids.pathClass])).rows;
  expect(log.map((r) => [r.decision, r.career_path_version])).toEqual([["reviewed", 1], ["revalidated", 2]]);
});
it("hides classifications of a retired career path and lets a reviewer withdraw one", async () => {
  await as(admin, () => db.query("SELECT save_career_path($1,'synthetic_path','Hướng nghề giả','Synthetic path','Định nghĩa','Definition','Rule v2',null,'{}',false)", [ids.path]));
  expect((await publicRows()).map((r) => (r as { id: string }).id)).toEqual([ids.fieldClass]);
  await review(admin, ids.fieldClass, "rejected", "Wrong field");
  expect(await publicRows()).toHaveLength(0);
  await expect(review(admin, ids.fieldClass, "reviewed")).rejects.toThrow("classification_already_decided");
  // A rejected row no longer blocks a corrected proposal for the same target.
  await propose(proposer);
});
it("keeps decisions and drafts away from visitors and direct writes away from everyone", async () => {
  await expect(as(null, () => db.query("SELECT * FROM classification_reviews"))).rejects.toThrow(/permission denied/);
  expect((await as(proposer, () => db.query("SELECT * FROM classification_reviews"))).rows.length).toBeGreaterThan(0);
  await expect(as(admin, () => db.query("UPDATE programme_classifications SET status='reviewed'"))).rejects.toThrow(/permission denied/);
  await expect(as(admin, () => db.query("SELECT url_host('https://x.test/')"))).rejects.toThrow(/permission denied/);
});
