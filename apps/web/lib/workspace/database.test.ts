import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
// Synthetic users and rows in a disposable in-memory database only.
const db = new PGlite();
const alice = "11111111-1111-4111-8111-111111111111"; // bootstrapped administrator
const bob = "22222222-2222-4222-8222-222222222222";
const dir = "../../packages/db/prisma/migrations";
let sweden: string, source: string, draftUniversity: string, reviewedUniversity: string;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for (const name of readdirSync(dir).filter((n) => /^\d{14}_/.test(n)).sort()) await db.exec(readFileSync(`${dir}/${name}/migration.sql`, "utf8"));
  for (const id of [alice, bob]) await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await db.query("SELECT bootstrap_administrator($1)", [alice]);
  sweden = (await db.query<{ id: string }>("SELECT id FROM countries WHERE slug='sweden'")).rows[0].id;
  source = (await db.query<{ id: string }>("SELECT id FROM sources LIMIT 1")).rows[0].id;
  const doc = (await db.query<{ id: string }>(`INSERT INTO documents(source_id,canonical_url,content_hash,metadata_hash,retrieved_at,ingestion_method)
    SELECT id,canonical_url,repeat('a',64),repeat('b',64),now(),'manual' FROM sources WHERE id=$1 RETURNING id`, [source])).rows[0].id;
  const uni = async (name: string, status: string) => (await db.query<{ id: string }>(
    "INSERT INTO universities(country_id,name,official_url,document_id,evidence_excerpt,status,created_by) VALUES($1,$2,'https://u.example.test/',$3,'e',$4,$5) RETURNING id",
    [sweden, name, doc, status, alice])).rows[0].id;
  draftUniversity = await uni("Synthetic draft university", "proposed");
  reviewedUniversity = await uni("Synthetic reviewed university", "reviewed");
}, 60000);
afterAll(() => db.close());
async function as<T>(id: string | null, fn: () => Promise<T>) {
  if (id) await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`SET SESSION AUTHORIZATION ${id ? "authenticated" : "anon"}`);
  try { return await fn(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
const count = (table: string) => db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`).then((r) => r.rows[0].n);

it("keeps every workspace table owner-only, even from an administrator", async () => {
  const project = (await as(bob, () => db.query<{ id: string }>("INSERT INTO research_projects(name) VALUES('Synthetic plan 2028') RETURNING id"))).rows[0].id;
  await as(bob, () => db.query("INSERT INTO notes(project_id,content) VALUES($1,'private synthetic note')", [project]));
  await as(bob, () => db.query("INSERT INTO user_plans(target_year) VALUES(2028)"));
  await as(alice, async () => {
    for (const t of ["research_projects", "notes", "user_plans", "saved_items"]) expect(await count(t)).toBe(0);
    expect((await db.query("UPDATE research_projects SET name='hijack' WHERE id=$1", [project])).affectedRows).toBe(0);
    expect((await db.query("DELETE FROM notes")).affectedRows).toBe(0);
  });
  await as(null, async () => { await expect(db.query("SELECT * FROM notes")).rejects.toThrow(/permission denied/); });
  expect(await as(bob, () => count("notes"))).toBe(1);
});
it("sets the owner from the session and refuses writing rows for someone else", async () => {
  await expect(as(alice, () => db.query("INSERT INTO research_projects(user_id,name) VALUES($1,'forged')", [bob]))).rejects.toThrow(/row-level security/);
  const own = (await as(alice, () => db.query<{ user_id: string }>("INSERT INTO research_projects(name) VALUES('Alice project') RETURNING user_id"))).rows[0];
  expect(own.user_id).toBe(alice);
});
it("bookmarks only publicly visible items, once each, and only into own projects", async () => {
  await expect(as(bob, () => db.query("INSERT INTO saved_items(university_id) VALUES($1)", [draftUniversity]))).rejects.toThrow(/row-level security/);
  await as(bob, () => db.query("INSERT INTO saved_items(university_id) VALUES($1)", [reviewedUniversity]));
  await expect(as(bob, () => db.query("INSERT INTO saved_items(university_id) VALUES($1)", [reviewedUniversity]))).rejects.toThrow(/duplicate key/);
  await expect(as(bob, () => db.query("INSERT INTO saved_items(country_id,university_id) VALUES($1,$2)", [sweden, reviewedUniversity]))).rejects.toThrow(/check constraint/);
  const aliceProject = (await db.query<{ id: string }>("SELECT id FROM research_projects WHERE user_id=$1", [alice])).rows[0].id;
  await expect(as(bob, () => db.query("INSERT INTO saved_items(country_id,project_id) VALUES($1,$2)", [sweden, aliceProject]))).rejects.toThrow(/row-level security/);
  await as(bob, () => db.query("INSERT INTO saved_items(source_id) VALUES($1)", [source]));
  expect(await as(bob, () => count("saved_items"))).toBe(2);
});
it("stores a budget only as a complete amount + currency + period", async () => {
  await expect(as(bob, () => db.query("UPDATE user_plans SET budget_amount=1000"))).rejects.toThrow(/check constraint/);
  await expect(as(bob, () => db.query("UPDATE user_plans SET budget_amount=1000,budget_currency='eur',budget_period='per_year'"))).rejects.toThrow(/check constraint/);
  await as(bob, () => db.query("UPDATE user_plans SET budget_amount=1000,budget_currency='EUR',budget_period='per_year'"));
  await as(bob, () => db.query("INSERT INTO user_plan_countries(country_id) VALUES($1)", [sweden]));
});
it("wipes only the caller's own workspace", async () => {
  const result = (await as(bob, () => db.query<{ r: Record<string, number> }>("SELECT delete_my_workspace() AS r"))).rows[0].r;
  expect(result).toMatchObject({ notes: 1, saved: 2, projects: 1, plan: 1 });
  expect(await count("research_projects")).toBe(1); // Alice's project survives
  await expect(as(null, () => db.query("SELECT delete_my_workspace()"))).rejects.toThrow(/permission denied/);
});
it("deletes personal data together with the account", async () => {
  const carol = "33333333-3333-4333-8333-333333333333";
  await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [carol]);
  await as(carol, async () => {
    const p = (await db.query<{ id: string }>("INSERT INTO research_projects(name) VALUES('Carol plan') RETURNING id")).rows[0].id;
    await db.query("INSERT INTO research_project_countries(project_id,country_id) VALUES($1,$2)", [p, sweden]);
    await db.query("INSERT INTO notes(project_id,content) VALUES($1,'n')", [p]);
    await db.query("INSERT INTO saved_items(country_id,project_id) VALUES($1,$2)", [sweden, p]);
    await db.query("INSERT INTO user_plans(target_year) VALUES(2030)");
  });
  await db.query("DELETE FROM auth.users WHERE id=$1", [carol]);
  for (const t of ["notes", "saved_items", "user_plans", "research_project_countries"]) {
    expect((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t} WHERE ${t === "research_project_countries" ? "true" : `user_id='${carol}'`}`)).rows[0].n).toBe(0);
  }
});
