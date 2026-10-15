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
// L6 (Decision Log 2026-10-15, KHLOE-158): a real browser by default, per-URL opt-out.
it("renders pages in a browser by default, lets an admin opt a URL out, and tells the worker", async () => {
  const due = async () => (await crawler(() => db.query<{ url: string; render_js: boolean }>("SELECT url, render_js FROM crawler_due_targets()"))).rows;
  expect((await due()).every((t) => t.render_js)).toBe(true);
  const plain = (await as("authenticated", () => db.query<{ id: string }>(
    "SELECT save_crawl_target(null,$1,'https://agency.example.test/plain','page',null,20,null,true,false) AS id", [source]), admin)).rows[0].id;
  expect((await due()).find((t) => t.url === "https://agency.example.test/plain")).toEqual({ url: "https://agency.example.test/plain", render_js: false });
  await expect(as("authenticated", () => db.query("SELECT save_crawl_target($1,$2,'https://agency.example.test/plain','page',null,20,null,true,null)", [plain, source]), admin))
    .rejects.toThrow("crawler_invalid");
  const audit = (await db.query<{ details: { after: { render_js: boolean } } }>("SELECT details FROM access_audit WHERE action='crawl_target.saved' AND target_id=$1", [plain])).rows[0];
  expect(audit.details.after.render_js).toBe(false);
  await as("authenticated", () => db.query("SELECT save_crawl_target($1,$2,'https://agency.example.test/plain','page',null,20,null,false,false)", [plain, source]), admin);
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
// L7a (Decision Log 2026-10-15, KHLOE-159): versions of one page are one page for facts.
it("treats versions of one page as one page: no cross-version duplicates, move on confirm, superseded with a link", async () => {
  const url = "https://agency.example.test/permits";
  const v1 = (await record(pageTarget, url, "fetched", h("1"), "Tuition fee: SEK 100 per year.\nLanguage: English.")).document_id;
  const propose = (doc: string, value: string, excerpt: string) => as("authenticated", () => db.query<{ id: string }>(
    "SELECT propose_fact($1,'education','Synthetic programme',$2,$3,null,null,null,null,$4) AS id", [doc, `property ${value}`, value, excerpt]), admin);
  const tuition = (await propose(v1, "SEK 100 per year", "Tuition fee: SEK 100 per year.")).rows[0].id;
  const language = (await propose(v1, "Language: English", "Language: English.")).rows[0].id;
  for (const id of [tuition, language]) await as("authenticated", () => db.query("SELECT review_fact($1,'reviewed','checked',null)", [id]), admin);
  const v2 = await record(pageTarget, url, "fetched", h("2"), "Tuition fee: SEK 100 per year.\nTaught in English.");
  expect(v2.flagged_facts).toBe(2);
  // D2: the same claim on the new version is a duplicate of the old one.
  await expect(propose(v2.document_id, "SEK 100 per year", "Tuition fee: SEK 100 per year.")).rejects.toThrow("facts_duplicate");
  const taught = (await propose(v2.document_id, "Taught in English", "Taught in English.")).rows[0].id;
  // D3: confirming moves the fact only if its excerpt is in the new version.
  const resolve = (id: string, decision: string, related: string | null = null) =>
    as("authenticated", () => db.query("SELECT resolve_source_change($1,$2,'synthetic note',$3)", [id, decision, related]), admin);
  await expect(resolve(language, "revalidated")).rejects.toThrow("facts_excerpt_not_in_new_version");
  await resolve(tuition, "revalidated");
  const moved = (await db.query<{ document_id: string; source_changed_at: Date | null }>("SELECT document_id, source_changed_at FROM facts WHERE id=$1", [tuition])).rows[0];
  expect(moved).toEqual({ document_id: v2.document_id, source_changed_at: null });
  expect((await db.query("SELECT document_id FROM evidence WHERE fact_id=$1", [tuition])).rows).toEqual([{ document_id: v2.document_id }]);
  expect((await db.query("SELECT document_id, replaced_by_document_id FROM evidence_history WHERE fact_id=$1", [tuition])).rows)
    .toEqual([{ document_id: v1, replaced_by_document_id: v2.document_id }]);
  // D4: superseded needs a live fact from the same page, and records the link.
  await expect(resolve(language, "superseded", null)).rejects.toThrow("facts_invalid");
  await expect(resolve(language, "superseded", fact)).rejects.toThrow("facts_invalid"); // rejected earlier
  await expect(resolve(language, "superseded", language)).rejects.toThrow("facts_invalid");
  await resolve(language, "superseded", taught);
  expect((await db.query("SELECT status FROM facts WHERE id=$1", [language])).rows).toEqual([{ status: "rejected" }]);
  expect((await db.query("SELECT decision, related_fact_id FROM fact_reviews WHERE fact_id=$1 ORDER BY created_at DESC LIMIT 1", [language])).rows)
    .toEqual([{ decision: "superseded", related_fact_id: taught }]);
  // The history is read-only and for editors only.
  await as("anon", async () => { await expect(db.query("SELECT * FROM evidence_history")).rejects.toThrow(/permission denied/); });
  await as("authenticated", async () => { expect((await db.query("SELECT * FROM evidence_history")).rows).toHaveLength(0); }, member);
  await as("authenticated", async () => { await expect(db.query("DELETE FROM evidence_history")).rejects.toThrow(/permission denied/); }, admin);
});
// PR 1 (docs/architecture/pr1-structured-content-plan.md §7, KHLOE-161).
it("stores structure snapshots with history: database hash, no duplicate for an unchanged or reordered structure, serialised per document", async () => {
  const url = "https://agency.example.test/permits";
  const doc = (await record(pageTarget, url, "fetched", h("3"), "Structure page text")).document_id;
  const s1 = { formatVersion: "html-structure-v1", title: "T", pairs: [{ label: "Tuition fee", value: "SEK 1" }] };
  const s2 = { ...s1, pairs: [{ label: "Tuition fee", value: "SEK 2" }] };
  const save = (structure: object | string, at: string, d = doc, version = "html-structure-v1") => crawler(() => db.query<{ r: string }>(
    "SELECT crawler_record_structure($1,$2,$3,$4::jsonb,$5) AS r", [run, d, version, typeof structure === "string" ? structure : JSON.stringify(structure), at])).then((x) => x.rows[0].r);
  expect(await save(s1, "2026-10-10T01:00:00Z")).toBe("created");
  // Same content later, or the same JSON with keys in another order: no new snapshot.
  expect(await save(s1, "2026-10-10T02:00:00Z")).toBe("unchanged");
  expect(await save('{"pairs":[{"value":"SEK 1","label":"Tuition fee"}],"title":"T","formatVersion":"html-structure-v1"}', "2026-10-10T03:00:00Z")).toBe("unchanged");
  // A retried call (same capture) after a change is a no-op too.
  expect(await save(s2, "2026-10-10T04:00:00Z")).toBe("created");
  expect(await save(s2, "2026-10-10T04:00:00Z")).toBe("unchanged");
  // Back to s1: history keeps s1, s2, s1; the latest is s1 again (never stale).
  expect(await save(s1, "2026-10-10T05:00:00Z")).toBe("created");
  // A late-arriving older capture is kept as history and does not become the latest.
  expect(await save({ ...s1, title: "Older" }, "2026-10-10T00:30:00Z")).toBe("created");
  const rows = (await db.query<{ structure: { pairs: { value: string }[]; title: string }; structure_hash: string; crawler_run_id: string }>(
    "SELECT structure, structure_hash, crawler_run_id FROM document_structures WHERE document_id=$1 ORDER BY captured_at DESC, created_at DESC", [doc])).rows;
  expect(rows.map((r) => `${r.structure.title}:${r.structure.pairs[0].value}`)).toEqual(["T:SEK 1", "T:SEK 2", "T:SEK 1", "Older:SEK 1"]);
  expect(rows[0].structure_hash).toBe(rows[2].structure_hash);
  expect(rows[0].structure_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(rows[0].crawler_run_id).toBe(run);
  // Refusals: a document this run did not record, a wrong or mismatched format, a non-object, oversize, a future capture.
  const outside = (await db.query<{ id: string }>(`INSERT INTO documents(source_id,canonical_url,title,content_hash,hash_method,metadata_hash,retrieved_at,ingestion_method)
    VALUES($1,'https://agency.example.test/outside','x',repeat('9',64),'sha256-text-v1',repeat('b',64),now(),'crawler') RETURNING id`, [source])).rows[0].id;
  await expect(save(s1, "2026-10-10T06:00:00Z", outside)).rejects.toThrow("crawler_structure_not_recorded");
  await expect(save(s1, "2026-10-10T06:00:00Z", doc, "html-structure-v9")).rejects.toThrow("crawler_invalid");
  await expect(save({ ...s1, formatVersion: "other" }, "2026-10-10T06:00:00Z")).rejects.toThrow("crawler_invalid");
  await expect(save("[1,2]", "2026-10-10T06:00:00Z")).rejects.toThrow("crawler_invalid");
  await expect(save({ ...s1, big: "x".repeat(1_200_000) }, "2026-10-10T06:00:00Z")).rejects.toThrow(/crawler_invalid|check constraint/);
  await expect(save(s1, "2099-01-01T00:00:00Z")).rejects.toThrow("crawler_invalid");
  await db.query("UPDATE sources SET crawl_enabled=false WHERE id=$1", [source]);
  await expect(save(s2, "2026-10-10T07:00:00Z")).rejects.toThrow("crawler_target_not_allowed");
  await db.query("UPDATE sources SET crawl_enabled=true WHERE id=$1", [source]);
  // Visibility as document_texts; the crawler role has no table access.
  await as("anon", async () => { await expect(db.query("SELECT * FROM document_structures")).rejects.toThrow(/permission denied/); });
  await as("authenticated", async () => { expect((await db.query("SELECT * FROM document_structures")).rows).toHaveLength(0); }, member);
  await as("authenticated", async () => { expect((await db.query("SELECT * FROM document_structures WHERE document_id=$1", [doc])).rows).toHaveLength(4); }, admin);
  await as("authenticated", async () => { await expect(db.query("DELETE FROM document_structures")).rejects.toThrow(/permission denied/); }, admin);
  await crawler(async () => {
    await expect(db.query("SELECT * FROM document_structures")).rejects.toThrow(/permission denied/);
    await expect(db.query("INSERT INTO document_structures(document_id,format_version,structure,structure_hash,captured_at,crawler_run_id) VALUES($1,'html-structure-v1','{}',repeat('a',64),now(),$2)", [doc, run])).rejects.toThrow(/permission denied/);
  });
  await as("authenticated", async () => { await expect(db.query("SELECT crawler_record_structure($1,$2,'html-structure-v1','{}',now())", [run, doc])).rejects.toThrow(/permission denied/); }, admin);
});
// Implementation requirement 2: two runs open at the same time process the same
// page (interleaved; PGlite has one connection, the per-document advisory lock
// serialises real concurrency the same way).
it("keeps one consistent snapshot history when two open runs record the same page", async () => {
  const url = "https://agency.example.test/permits";
  const run2 = (await crawler(() => db.query<{ id: string }>("SELECT crawler_start_run('manual') AS id"))).rows[0].id;
  const recordIn = (r: string) => crawler(() => db.query<{ r: { outcome: string; document_id: string } }>(
    "SELECT crawler_record($1,$2,$3,200,'fetched',null,10,'Synthetic title',$4,$5,'Concurrent page text','\"e\"',null,now()) AS r", [r, pageTarget, url, h("6"), h("b")])).then((x) => x.rows[0].r);
  const a = await recordIn(run), b = await recordIn(run2);
  expect([a.outcome, b.outcome]).toEqual(["created", "unchanged"]);
  expect(b.document_id).toBe(a.document_id);
  const save = (r: string, value: string, at: string) => crawler(() => db.query<{ r: string }>("SELECT crawler_record_structure($1,$2,'html-structure-v1',$3::jsonb,$4) AS r",
    [r, a.document_id, JSON.stringify({ formatVersion: "html-structure-v1", v: value }), at])).then((x) => x.rows[0].r);
  // Same structure from both runs (same or different capture times): one row.
  expect(await save(run, "same", "2026-10-11T01:00:00Z")).toBe("created");
  expect(await save(run2, "same", "2026-10-11T01:00:00Z")).toBe("unchanged");
  expect(await save(run2, "same", "2026-10-11T01:00:05Z")).toBe("unchanged");
  // A real difference from the second run is recorded once, attributed to that run.
  expect(await save(run2, "changed", "2026-10-11T01:00:06Z")).toBe("created");
  expect(await save(run, "changed", "2026-10-11T01:00:07Z")).toBe("unchanged");
  expect((await db.query("SELECT structure->>'v' AS v, crawler_run_id FROM document_structures WHERE document_id=$1 ORDER BY captured_at", [a.document_id])).rows)
    .toEqual([{ v: "same", crawler_run_id: run }, { v: "changed", crawler_run_id: run2 }]);
  await crawler(() => db.query("SELECT crawler_finish_run($1,'succeeded',null)", [run2]));
});
// Review before merge (2026-10-15): captures recorded out of captured_at order
// must never change which snapshot is the latest, readers must agree on one
// deterministic "latest", and a late capture is compared with the capture just
// before it in time (not with the latest), so it adds no redundant history.
it("keeps the latest snapshot by capture time when older captures arrive late, with one deterministic reader", async () => {
  const url = "https://agency.example.test/permits";
  const doc = (await record(pageTarget, url, "fetched", h("7"), "Out of order page text")).document_id;
  const save = (v: string, at: string) => crawler(() => db.query<{ r: string }>("SELECT crawler_record_structure($1,$2,'html-structure-v1',$3::jsonb,$4) AS r",
    [run, doc, JSON.stringify({ formatVersion: "html-structure-v1", v }), at])).then((x) => x.rows[0].r);
  const latest = () => db.query<{ v: string; captured_at: Date }>(
    "SELECT structure->>'v' AS v, captured_at FROM document_structures_latest WHERE document_id=$1 AND format_version='html-structure-v1'", [doc]).then((x) => x.rows);
  expect(await save("S1", "2026-10-12T10:00:00Z")).toBe("created");
  expect(await save("S3", "2026-10-12T12:00:00Z")).toBe("created");
  // An older capture arriving after the newer one: kept as history, never the latest.
  expect(await save("S2", "2026-10-12T11:00:00Z")).toBe("created");
  expect(await latest()).toEqual([{ v: "S3", captured_at: new Date("2026-10-12T12:00:00Z") }]);
  // A late capture identical to the capture just before it in time adds nothing,
  // even though it differs from the latest.
  expect(await save("S1", "2026-10-12T10:30:00Z")).toBe("unchanged");
  // A late capture older than everything: history only.
  expect(await save("S0", "2026-10-12T09:00:00Z")).toBe("created");
  expect(await latest()).toEqual([{ v: "S3", captured_at: new Date("2026-10-12T12:00:00Z") }]);
  // Two different captures with the very same captured_at: readers agree on one
  // (the later recorded), every time.
  expect(await save("S4", "2026-10-12T12:00:00Z")).toBe("created");
  const first = await latest(), again = await latest();
  expect(first).toEqual([{ v: "S4", captured_at: new Date("2026-10-12T12:00:00Z") }]);
  expect(again).toEqual(first);
  expect((await db.query("SELECT structure->>'v' AS v FROM document_structures WHERE document_id=$1 ORDER BY captured_at, created_at", [doc])).rows.map((r) => (r as { v: string }).v))
    .toEqual(["S0", "S1", "S2", "S3", "S4"]);
  // The reader follows the table's RLS: editors only.
  await as("anon", async () => { await expect(db.query("SELECT * FROM document_structures_latest")).rejects.toThrow(/permission denied/); });
  await as("authenticated", async () => { expect((await db.query("SELECT * FROM document_structures_latest")).rows).toHaveLength(0); }, member);
  await as("authenticated", async () => { expect((await db.query("SELECT * FROM document_structures_latest WHERE document_id=$1", [doc])).rows).toHaveLength(1); }, admin);
});
// Regression (PR 1 design §3.5): pins today's behaviour, not changed by PR 1.
// Known bug, tracked separately as Linear KHLOE-162: when fixed, invert these expectations.
it("records a page that returns to an earlier text (A -> B -> A) as unchanged, without flagging facts on B", async () => {
  const url = "https://agency.example.test/permits";
  await record(pageTarget, url, "fetched", h("4"), "Version A text");
  const b = await record(pageTarget, url, "fetched", h("5"), "Version B text");
  const onB = (await as("authenticated", () => db.query<{ id: string }>(
    "SELECT propose_fact($1,'education','Synthetic programme','regression property','Version B','',null,null,null,'Version B text') AS id", [b.document_id]), admin)).rows[0].id;
  await as("authenticated", () => db.query("SELECT review_fact($1,'reviewed','checked',null)", [onB]), admin);
  const back = await record(pageTarget, url, "fetched", h("4"), "Version A text");
  expect(back).toMatchObject({ outcome: "unchanged", flagged_facts: 0 });
  expect((await db.query("SELECT source_changed_at FROM facts WHERE id=$1", [onB])).rows).toEqual([{ source_changed_at: null }]);
});
it("stops immediately when a source is switched off, and closes runs with counts", async () => {
  await db.query("UPDATE sources SET crawl_enabled=false WHERE id=$1", [source]);
  await expect(record(pageTarget, "https://agency.example.test/permits", "fetched", h("f"))).rejects.toThrow("crawler_target_not_allowed");
  expect((await crawler(() => db.query("SELECT * FROM crawler_due_targets()"))).rows).toHaveLength(0);
  const counts = (await crawler(() => db.query<{ c: Record<string, number> }>("SELECT crawler_finish_run($1,'succeeded',null) AS c", [run]))).rows[0].c;
  expect(counts).toMatchObject({ created: 11, unchanged: 2, not_modified: 1 });
  await db.query("UPDATE sources SET crawl_enabled=true WHERE id=$1", [source]);
  await expect(record(pageTarget, "https://agency.example.test/permits", "fetched")).rejects.toThrow("crawler_run_closed");
});
