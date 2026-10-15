import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { canOpenPreview, canReadStructures } from "./structure-view";

// PR 1.5 requirement 1–2: the roles that exist in the live database
// (Administrator, Editor = documents.ingest, AI Draft = facts.propose, Member)
// plus a crawler-only operator, each running the preview's SELECTs under real
// RLS as `authenticated`. No service role anywhere; the page gate
// (canOpenPreview/canReadStructures) must agree with what RLS returns.
// Synthetic data in a disposable in-memory database only.
const db = new PGlite();
const dir = "../../packages/db/prisma/migrations";
const users = {
  admin: "11111111-1111-4111-8111-111111111111",
  editor: "22222222-2222-4222-8222-222222222222",
  aiDraft: "33333333-3333-4333-8333-333333333333",
  operator: "44444444-4444-4444-8444-444444444444",
  member: "55555555-5555-4555-8555-555555555555",
};
const roles: Record<keyof typeof users, string[]> = {
  admin: [], editor: ["documents.ingest"], aiDraft: ["facts.propose"], operator: ["crawler.manage"], member: [],
};
let doc: string;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for (const name of readdirSync(dir).filter((n) => /^\d{14}_/.test(n)).sort()) await db.exec(readFileSync(`${dir}/${name}/migration.sql`, "utf8"));
  for (const id of Object.values(users)) await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await db.query("SELECT bootstrap_administrator($1)", [users.admin]);
  for (const [who, perms] of Object.entries(roles) as [keyof typeof users, string[]][]) {
    if (who === "admin" || who === "member") continue;
    const role = (await db.query<{ id: string }>("INSERT INTO roles(name,description) VALUES($1,'synthetic') RETURNING id", [`Test ${who}`])).rows[0].id;
    for (const p of perms) await db.query("INSERT INTO role_permissions(role_id,permission_key) VALUES($1,$2)", [role, p]);
    await db.query("INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)", [users[who], role]);
  }
  await db.exec("CREATE ROLE crawler_login LOGIN IN ROLE nordic_crawler_ops");
  const source = (await db.query<{ id: string }>(`INSERT INTO sources(name,canonical_url,source_tier,status,authority_notes,last_verified_at,crawl_policy,crawl_enabled)
    VALUES('Synthetic university','https://uni.example.test/','T2','verified','synthetic',now(),'approved',true) RETURNING id`)).rows[0].id;
  const target = (await as(users.admin, () => db.query<{ id: string }>("SELECT save_crawl_target(null,$1,'https://uni.example.test/p','page',null,20,null,true) AS id", [source]))).rows[0].id;
  await db.exec("SET SESSION AUTHORIZATION crawler_login");
  const run = (await db.query<{ id: string }>("SELECT crawler_start_run('local') AS id")).rows[0].id;
  doc = (await db.query<{ r: { document_id: string } }>(
    "SELECT crawler_record($1,$2,'https://uni.example.test/p',200,'fetched',null,10,'Synthetic programme',repeat('a',64),repeat('b',64),'Synthetic text','\"e\"',null,now()) AS r", [run, target])).rows[0].r.document_id;
  await db.query("SELECT crawler_record_structure($1,$2,'html-structure-v1',$3::jsonb,now() - interval '1 minute')",
    [run, doc, JSON.stringify({ formatVersion: "html-structure-v1", title: "Synthetic programme", pairs: [{ label: "Tuition fee", value: "SEK 1" }] })]);
  await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE");
}, 60000);
afterAll(() => db.close());

async function as<T>(user: string, fn: () => Promise<T>) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("SET SESSION AUTHORIZATION authenticated");
  try { return await fn(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
const count = async (user: string, sql: string) => (await as(user, () => db.query(sql, [doc]))).rows.length;
const permissionsOf = async (user: string) => (await as(user, () => db.query<{ k: string }>(
  "SELECT DISTINCT rp.permission_key AS k FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id WHERE ur.user_id = auth.uid()"))).rows.map((r) => r.k);

it("each role sees exactly what the page promises, enforced by RLS", async () => {
  const seen: Record<string, object> = {};
  for (const [who, id] of Object.entries(users)) {
    const perms = await permissionsOf(id);
    seen[who] = {
      opens: canOpenPreview(perms),
      reads: canReadStructures(perms),
      structures: await count(id, "SELECT id FROM document_structures WHERE document_id=$1"),
      latest: await count(id, "SELECT id FROM document_structures_latest WHERE document_id=$1"),
      runItems: await count(id, "SELECT id FROM crawler_run_items WHERE document_id=$1"),
    };
  }
  expect(seen).toEqual({
    admin: { opens: true, reads: true, structures: 1, latest: 1, runItems: 1 },
    editor: { opens: true, reads: true, structures: 1, latest: 1, runItems: 0 },
    aiDraft: { opens: true, reads: true, structures: 1, latest: 1, runItems: 0 },
    // Opens the page (to see crawl attempts) but RLS hides structures: the page shows "no access".
    operator: { opens: true, reads: false, structures: 0, latest: 0, runItems: 1 },
    member: { opens: false, reads: false, structures: 0, latest: 0, runItems: 0 },
  });
});

it("the view runs as the caller (security_invoker), so it never widens access", async () => {
  const opts = (await db.query<{ reloptions: string[] | null }>("SELECT reloptions FROM pg_class WHERE oid='public.document_structures_latest'::regclass")).rows[0].reloptions;
  expect(opts).toContain("security_invoker=true");
  await db.exec("SET SESSION AUTHORIZATION anon");
  try { await expect(db.query("SELECT * FROM document_structures_latest")).rejects.toThrow(/permission denied/); }
  finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
});

it("is read-only for every signed-in role, including Administrator", async () => {
  for (const id of Object.values(users)) {
    await expect(as(id, () => db.query("DELETE FROM document_structures"))).rejects.toThrow(/permission denied/);
    await expect(as(id, () => db.query("UPDATE document_structures SET captured_at=now()"))).rejects.toThrow(/permission denied/);
  }
});
