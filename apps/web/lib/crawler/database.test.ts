import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
// Synthetic sources/pages in a disposable in-memory database only.
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const dir = "../../packages/db/prisma/migrations";
const h = (c: string) => c.repeat(64);
let source: string, pageTarget: string, sitemapTarget: string, run: string, firstDoc: string, fact: string;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for (const name of readdirSync(dir).filter((n) => /^\d{14}_/.test(n)).sort()) await db.exec(readFileSync(`${dir}/${name}/migration.sql`, "utf8"));
  for (const id of [admin, member]) await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await db.query("SELECT bootstrap_administrator($1)", [admin]);
  // The operator-created login role, as documented: inherits only nordic_crawler_ops.
  await db.exec("CREATE ROLE crawler_login LOGIN IN ROLE nordic_crawler_ops");
  source = (await db.query<{ id: string }>(`INSERT INTO sources(name,canonical_url,source_tier,status,authority_notes,last_verified_at,crawl_policy,crawl_enabled)
    VALUES('Synthetic agency','https://agency.example.test/','T1','verified','synthetic',now(),'approved',true) RETURNING id`)).rows[0].id;
}, 60000);
afterAll(() => db.close());
async function as<T>(role: string, fn: () => Promise<T>, user?: string) {
  if (user) await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec(`SET SESSION AUTHORIZATION ${role}`);
  try { return await fn(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
const crawler = <T>(fn: () => Promise<T>) => as("crawler_login", fn);
const record = (target: string, url: string, outcome: string, hash = h("a"), text = "Synthetic page text") => crawler(() => db.query<{ r: { outcome: string; document_id: string; flagged_facts: number } }>(
  "SELECT crawler_record($1,$2,$3,200,$4,null,10,'Synthetic title',$5,$6,$7,'\"etag-1\"',null,now()) AS r", [run, target, url, outcome, hash, h("b"), text])).then((x) => x.rows[0].r);

it("registers crawl URLs only with crawler.manage and only on the source's own origin", async () => {
  const save = (url: string, kind = "page", prefix: string | null = null) => db.query<{ id: string }>(
    "SELECT save_crawl_target(null,$1,$2,$3,$4,20,null,true) AS id", [source, url, kind, prefix]);
  await expect(as("authenticated", () => save("https://agency.example.test/permits"), member)).rejects.toThrow("crawler_forbidden");
  await expect(as("authenticated", () => save("https://elsewhere.example.test/permits"), admin)).rejects.toThrow("crawler_url_not_source");
  pageTarget = (await as("authenticated", () => save("https://agency.example.test/permits"), admin)).rows[0].id;
  sitemapTarget = (await as("authenticated", () => save("https://agency.example.test/sitemap.xml", "sitemap", "/study/"), admin)).rows[0].id;
  await expect(as("authenticated", () => save("https://agency.example.test/permits"), admin)).rejects.toThrow("crawler_duplicate");
});
it("gives the crawler role no table access at all — functions only", async () => {
  await crawler(async () => {
    for (const table of ["sources", "documents", "facts", "crawl_targets", "notes", "user_plans", "document_texts"]) {
      await expect(db.query(`SELECT * FROM ${table} LIMIT 1`)).rejects.toThrow(/permission denied/);
    }
    await expect(db.query("INSERT INTO documents(source_id) VALUES($1)", [source])).rejects.toThrow(/permission denied/);
  });
  run = (await crawler(() => db.query<{ id: string }>("SELECT crawler_start_run('local') AS id"))).rows[0].id;
  const due = (await crawler(() => db.query<{ url: string }>("SELECT * FROM crawler_due_targets()"))).rows.map((r) => r.url);
  expect(due.sort()).toEqual(["https://agency.example.test/permits", "https://agency.example.test/sitemap.xml"]);
});
it("stores a new version once, with private text, and treats repeats as unchanged", async () => {
  const first = await record(pageTarget, "https://agency.example.test/permits", "fetched");
  expect(first.outcome).toBe("created");
  firstDoc = first.document_id;
  const doc = (await db.query<{ hash_method: string; ingestion_method: string }>("SELECT * FROM documents WHERE id=$1", [firstDoc])).rows[0];
  expect(doc).toMatchObject({ hash_method: "sha256-text-v1", ingestion_method: "crawler" });
  expect((await record(pageTarget, "https://agency.example.test/permits", "fetched")).outcome).toBe("unchanged");
  expect((await record(pageTarget, "https://agency.example.test/permits", "not_modified")).outcome).toBe("not_modified");
  expect((await db.query("SELECT * FROM documents WHERE source_id=$1", [source])).rows).toHaveLength(1);
  await as("anon", async () => { await expect(db.query("SELECT * FROM document_texts")).rejects.toThrow(/permission denied/); });
  await as("authenticated", async () => { expect((await db.query("SELECT * FROM document_texts")).rows).toHaveLength(0); }, member);
  await as("authenticated", async () => { expect((await db.query("SELECT * FROM document_texts")).rows).toHaveLength(1); }, admin);
});
it("refuses URLs that were not registered", async () => {
  await expect(record(pageTarget, "https://agency.example.test/other", "fetched")).rejects.toThrow("crawler_url_not_registered");
  await expect(record(sitemapTarget, "https://agency.example.test/work/x", "fetched")).rejects.toThrow("crawler_url_not_registered");
  await expect(record(sitemapTarget, "https://agency.example.test", "fetched")).rejects.toThrow("crawler_url_not_registered");
  await expect(record(sitemapTarget, "https://other.example.test/study/x", "fetched")).rejects.toThrow("crawler_url_not_registered");
  expect((await record(sitemapTarget, "https://agency.example.test/study/a", "fetched", h("c"))).outcome).toBe("created");
});
it("flags published facts when their page changes, keeps them public, and lets a reviewer resolve", async () => {
  fact = (await as("authenticated", () => db.query<{ id: string }>(
    "SELECT propose_fact($1,'immigration','Synthetic permit','fee','0',null,null,null,null,'Synthetic page text') AS id", [firstDoc]), admin)).rows[0].id;
  await as("authenticated", () => db.query("SELECT review_fact($1,'reviewed','checked',null)", [fact]), admin);
  const changed = await record(pageTarget, "https://agency.example.test/permits", "fetched", h("d"), "Synthetic page text, changed");
  expect(changed).toMatchObject({ outcome: "created", flagged_facts: 1 });
  const row = (await db.query<{ source_changed_at: Date | null; source_changed_document_id: string; status: string }>("SELECT * FROM facts WHERE id=$1", [fact])).rows[0];
  expect(row.status).toBe("reviewed");
  expect(row.source_changed_document_id).toBe(changed.document_id);
  await as("anon", async () => { expect((await db.query("SELECT id FROM facts WHERE id=$1", [fact])).rows).toHaveLength(1); });
  await expect(as("authenticated", () => db.query("SELECT resolve_source_change($1,'revalidated','x')", [fact]), member)).rejects.toThrow("facts_forbidden");
  await as("authenticated", () => db.query("SELECT resolve_source_change($1,'revalidated','Still matches the new page')", [fact]), admin);
  expect((await db.query<{ source_changed_at: Date | null }>("SELECT source_changed_at FROM facts WHERE id=$1", [fact])).rows[0].source_changed_at).toBeNull();
  await expect(as("authenticated", () => db.query("SELECT resolve_source_change($1,'revalidated','again')", [fact]), admin)).rejects.toThrow("facts_not_flagged");
  await record(pageTarget, "https://agency.example.test/permits", "fetched", h("e"), "Changed again");
  await as("authenticated", () => db.query("SELECT resolve_source_change($1,'rejected','No longer stated')", [fact]), admin);
  await as("anon", async () => { expect((await db.query("SELECT id FROM facts WHERE id=$1", [fact])).rows).toHaveLength(0); });
  expect((await db.query("SELECT decision FROM fact_reviews WHERE fact_id=$1 ORDER BY created_at", [fact])).rows.map((r) => (r as { decision: string }).decision))
    .toEqual(["reviewed", "revalidated", "rejected"]);
});
it("stops immediately when a source is switched off, and closes runs with counts", async () => {
  await db.query("UPDATE sources SET crawl_enabled=false WHERE id=$1", [source]);
  await expect(record(pageTarget, "https://agency.example.test/permits", "fetched", h("f"))).rejects.toThrow("crawler_target_not_allowed");
  expect((await crawler(() => db.query("SELECT * FROM crawler_due_targets()"))).rows).toHaveLength(0);
  const counts = (await crawler(() => db.query<{ c: Record<string, number> }>("SELECT crawler_finish_run($1,'succeeded',null) AS c", [run]))).rows[0].c;
  expect(counts).toMatchObject({ created: 4, unchanged: 1, not_modified: 1 });
  await db.query("UPDATE sources SET crawl_enabled=true WHERE id=$1", [source]);
  await expect(record(pageTarget, "https://agency.example.test/permits", "fetched")).rejects.toThrow("crawler_run_closed");
});
