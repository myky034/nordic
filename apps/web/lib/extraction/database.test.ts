import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
// Synthetic users, source and page text in a disposable in-memory database only.
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const aiAccount = "33333333-3333-4333-8333-333333333333";
const dir = "../../packages/db/prisma/migrations";
const pageText = [
  "Residence permit for studies",
  "You must show that you have at least SEK 10,656 per month for the whole permit period.",
  "Applications made from 1 January 2026 follow these rules.",
].join("\n");
let doc: string, noTextDoc: string, request: string, run: string;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for (const name of readdirSync(dir).filter((n) => /^\d{14}_/.test(n)).sort()) await db.exec(readFileSync(`${dir}/${name}/migration.sql`, "utf8"));
  for (const id of [admin, member, aiAccount]) await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await db.query("SELECT bootstrap_administrator($1)", [admin]);
  const role = (await db.query<{ id: string }>("INSERT INTO roles(name) VALUES('Synthetic AI draft') RETURNING id")).rows[0].id;
  await db.query("INSERT INTO role_permissions(role_id,permission_key) VALUES($1,'facts.propose')", [role]);
  await db.query("INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)", [aiAccount, role]);
  // The operator-created login role, as documented: member of nordic_extractor_ops only.
  await db.exec("CREATE ROLE extractor_login LOGIN IN ROLE nordic_extractor_ops");
  const source = (await db.query<{ id: string }>(`INSERT INTO sources(name,canonical_url,source_tier,status,authority_notes,last_verified_at)
    VALUES('Synthetic agency','https://agency.example.test/','T1','verified','synthetic',now()) RETURNING id`)).rows[0].id;
  const insertDoc = async (hash: string) => (await db.query<{ id: string }>(`INSERT INTO documents(source_id,canonical_url,title,content_hash,hash_method,metadata_hash,retrieved_at,ingestion_method)
    VALUES($1,'https://agency.example.test/permits','Synthetic permits',$2,'sha256-text-v1',repeat('b',64),'2026-09-20T00:00:00Z','crawler') RETURNING id`, [source, hash])).rows[0].id;
  doc = await insertDoc("a".repeat(64));
  noTextDoc = await insertDoc("c".repeat(64));
  await db.query("INSERT INTO document_texts(document_id,text,extractor) VALUES($1,$2,'html-text-v1')", [doc, pageText]);
}, 60000);
afterAll(() => db.close());
async function as<T>(role: string, fn: () => Promise<T>, user?: string) {
  if (user) await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec(`SET SESSION AUTHORIZATION ${role}`);
  try { return await fn(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
const worker = <T>(fn: () => Promise<T>) => as("extractor_login", fn);
const good = { topic: "immigration", subject: "Residence permit for studies", predicate: "maintenance requirement",
  value: "at least SEK 10 656 per month", unit: null, excerpt: "You must show that you have at least SEK 10,656 per month", country: "sweden", confidence: 0.9 };
const propose = (candidate: object) => worker(() => db.query<{ r: { outcome: string; reason: string | null; fact_id: string | null } }>(
  "SELECT extractor_propose($1,$2,$3) AS r", [run, request, JSON.stringify(candidate)])).then((x) => x.rows[0].r);

it("lets editors request extraction only for documents with stored text, once at a time", async () => {
  await expect(as("authenticated", () => db.query("SELECT request_extraction($1)", [doc]), member)).rejects.toThrow("extraction_forbidden");
  await expect(as("authenticated", () => db.query("SELECT request_extraction($1)", [noTextDoc]), admin)).rejects.toThrow("extraction_no_text");
  const first = (await as("authenticated", () => db.query<{ id: string }>("SELECT request_extraction($1) AS id", [doc]), admin)).rows[0].id;
  await expect(as("authenticated", () => db.query("SELECT request_extraction($1)", [doc]), admin)).rejects.toThrow("extraction_already_open");
  await as("authenticated", () => db.query("SELECT cancel_extraction($1)", [first]), admin);
  request = (await as("authenticated", () => db.query<{ id: string }>("SELECT request_extraction($1) AS id", [doc]), admin)).rows[0].id;
  await as("anon", async () => { await expect(db.query("SELECT * FROM extraction_requests")).rejects.toThrow(/permission denied/); });
  await as("authenticated", async () => { expect((await db.query("SELECT * FROM extraction_requests")).rows).toHaveLength(0); }, member);
});
it("gives the worker role no table access and refuses to start without a suitable AI account", async () => {
  await worker(async () => {
    for (const table of ["documents", "document_texts", "facts", "extraction_requests", "notes", "sources"]) {
      await expect(db.query(`SELECT * FROM ${table} LIMIT 1`)).rejects.toThrow(/permission denied/);
    }
  });
  await expect(worker(() => db.query("SELECT extractor_start_run('local','example.test','synthetic-model','v1')"))).rejects.toThrow("extraction_account_missing");
  await expect(as("authenticated", () => db.query("SELECT set_extraction_account($1)", [aiAccount]), member)).rejects.toThrow("extraction_forbidden");
  // An account that can review its own proposals is refused.
  await expect(as("authenticated", () => db.query("SELECT set_extraction_account($1)", [admin]), admin)).rejects.toThrow("extraction_account_unsuitable");
  await as("authenticated", () => db.query("SELECT set_extraction_account($1)", [aiAccount]), admin);
  run = (await worker(() => db.query<{ id: string }>("SELECT extractor_start_run('local','example.test','synthetic-model','v1') AS id"))).rows[0].id;
  const claimed = (await worker(() => db.query<{ request_id: string; text: string; url: string }>("SELECT * FROM extractor_claim($1,5)", [run]))).rows;
  expect(claimed).toHaveLength(1);
  expect(claimed[0]).toMatchObject({ request_id: request, text: pageText, url: "https://agency.example.test/permits" });
  expect((await worker(() => db.query("SELECT * FROM extractor_claim($1,5)", [run]))).rows).toHaveLength(0);
  await expect(worker(() => db.query("SELECT * FROM extractor_claim($1,50)", [run]))).rejects.toThrow("extraction_invalid");
});
it("turns a grounded candidate into a hidden AI proposal with evidence from the document", async () => {
  const result = await propose(good);
  expect(result.outcome).toBe("proposed");
  const fact = (await db.query<{ status: string; origin: string; ai_model: string; ai_confidence: string; created_by: string; country_id: string | null }>(
    "SELECT * FROM facts WHERE id=$1", [result.fact_id])).rows[0];
  expect(fact).toMatchObject({ status: "proposed", origin: "ai", ai_model: "synthetic-model", ai_confidence: "0.90", created_by: aiAccount });
  expect(fact.country_id).not.toBeNull();
  const evidence = (await db.query<{ source_url: string; retrieved_at: Date }>("SELECT * FROM evidence WHERE fact_id=$1", [result.fact_id])).rows[0];
  expect(evidence.source_url).toBe("https://agency.example.test/permits");
  expect(evidence.retrieved_at.toISOString()).toBe("2026-09-20T00:00:00.000Z");
  await as("anon", async () => { expect((await db.query("SELECT id FROM facts WHERE id=$1", [result.fact_id])).rows).toHaveLength(0); });
});
it("rejects fabricated or ungrounded candidates and records why", async () => {
  const cases: [object, string][] = [
    [{ ...good, predicate: "other", excerpt: "You must show that you have at least SEK 99,999 per month" }, "not found verbatim"],
    [{ ...good, predicate: "other", value: "at least SEK 12,000 per month" }, "Number 12000 not found"],
    [{ ...good, predicate: "other", topic: "visa_guarantee" }, "Topic not in the allowed list"],
    [{ ...good, predicate: "other", country: "atlantis" }, "Unknown country"],
    [{ ...good, predicate: "other", valid_from: "2027-01-01", excerpt: "Applications made from 1 January 2026 follow these rules.", value: "rules apply" }, "Number 2027 not found"],
    [{ ...good, predicate: "other", valid_from: "2026-02-30", excerpt: "Applications made from 1 January 2026 follow these rules.", value: "rules apply" }, "real calendar dates"],
    [{ ...good, predicate: "other", confidence: "high" }, "Confidence"],
  ];
  for (const [candidate, reason] of cases) {
    const r = await propose(candidate);
    expect(r.outcome).toBe("invalid");
    expect(r.reason).toContain(reason);
  }
  expect((await propose(good)).outcome).toBe("duplicate");
  const okDate = await propose({ ...good, predicate: "rules apply from", value: "1 January 2026", valid_from: "2026-01-01",
    excerpt: "Applications made from 1 January 2026 follow these rules." });
  expect(okDate.outcome).toBe("proposed");
  expect((await db.query("SELECT * FROM extraction_items WHERE request_id=$1", [request])).rows).toHaveLength(cases.length + 3);
});
it("caps proposals per document and closes the request and run with counts and tokens", async () => {
  // Two proposals exist already, so 28 more fit under the cap of 30.
  for (let i = 0; i < 28; i++) expect((await propose({ ...good, predicate: `synthetic predicate ${i}` })).outcome).toBe("proposed");
  expect((await propose({ ...good, predicate: "one too many" })).outcome).toBe("limit");
  await worker(() => db.query("SELECT extractor_finish_request($1,$2,'done','ok',1200,300,true)", [run, request]));
  const counts = (await worker(() => db.query<{ c: Record<string, number> }>("SELECT extractor_finish_run($1,'succeeded',null) AS c", [run]))).rows[0].c;
  expect(counts).toEqual({ proposed: 30, invalid: 7, duplicate: 1, limit: 1 });
  const runRow = (await db.query<{ input_tokens: number; output_tokens: number }>("SELECT * FROM extraction_runs WHERE id=$1", [run])).rows[0];
  expect(runRow).toMatchObject({ input_tokens: 1200, output_tokens: 300 });
  expect((await db.query<{ status: string; truncated: boolean }>("SELECT * FROM extraction_requests WHERE id=$1", [request])).rows[0])
    .toMatchObject({ status: "done", truncated: true });
  await expect(propose(good)).rejects.toThrow("extraction_request_not_running");
});
