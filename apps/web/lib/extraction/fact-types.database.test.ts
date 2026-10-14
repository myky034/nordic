import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
// L3c (Decision Log 2026-10-14, option A): synthetic university, programme,
// pages and fact types in a disposable in-memory database only.
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
const aiAccount = "33333333-3333-4333-8333-333333333333";
const dir = "../../packages/db/prisma/migrations";
const programmeText = [
  "MSc Synthetic Project Management",
  "Tuition fee: SEK 145 000 per academic year for students outside the EU.",
  "Application deadline: 15 January 2027.",
  "English requirement: IELTS Academic overall band 6.5.",
].join("\n");
const ids: Record<string, string> = {};
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for (const name of readdirSync(dir).filter((n) => /^\d{14}_/.test(n)).sort()) await db.exec(readFileSync(`${dir}/${name}/migration.sql`, "utf8"));
  for (const id of [admin, aiAccount]) await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await db.query("SELECT bootstrap_administrator($1)", [admin]);
  const role = (await db.query<{ id: string }>("INSERT INTO roles(name) VALUES('Synthetic AI draft') RETURNING id")).rows[0].id;
  await db.query("INSERT INTO role_permissions(role_id,permission_key) VALUES($1,'facts.propose')", [role]);
  await db.query("INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)", [aiAccount, role]);
  await db.exec("CREATE ROLE extractor_login LOGIN IN ROLE nordic_extractor_ops");
  const one = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p)).rows[0].id;
  ids.sweden = await one("SELECT id FROM countries WHERE slug='sweden'");
  ids.denmark = await one("SELECT id FROM countries WHERE slug='denmark'");
  const source = await one(`INSERT INTO sources(name,canonical_url,source_tier,status,authority_notes,last_verified_at,country_id)
    VALUES('Synthetic University','https://www.uni.example.test/','T2','verified','synthetic',now(),$1) RETURNING id`, [ids.sweden]);
  const doc = async (url: string, hash: string, text: string) => {
    const id = await one(`INSERT INTO documents(source_id,canonical_url,title,content_hash,hash_method,metadata_hash,retrieved_at,ingestion_method)
      VALUES($1,$2,'Synthetic page',$3,'sha256-text-v1',repeat('b',64),'2026-10-14T00:00:00Z','crawler') RETURNING id`, [source, url, hash]);
    await db.query("INSERT INTO document_texts(document_id,text,extractor) VALUES($1,$2,'html-text-v1')", [id, text]);
    return id;
  };
  ids.programmeDoc = await doc("https://www.uni.example.test/msc?term=HT2026", "a".repeat(64), programmeText);
  ids.otherDoc = await doc("https://www.uni.example.test/news", "c".repeat(64), programmeText);
  ids.plainDoc = await doc("https://www.uni.example.test/about", "d".repeat(64), programmeText);
  // Reviewed university and programme; the programme's official URL differs
  // from the document only by host case and a trailing slash.
  ids.uni = await one(`INSERT INTO universities(country_id,name,official_url,document_id,evidence_excerpt,status,created_by,reviewed_at)
    VALUES($1,'Synthetic University','https://www.uni.example.test/news',$2,'Synthetic excerpt','reviewed',$3,now()) RETURNING id`, [ids.sweden, ids.otherDoc, admin]);
  ids.programme = await one(`INSERT INTO programmes(university_id,name,degree_type,official_url,document_id,evidence_excerpt,status,created_by,reviewed_at)
    VALUES($1,'MSc Synthetic','master','https://WWW.UNI.example.test/msc/?term=HT2026',$2,'Synthetic excerpt','reviewed',$3,now()) RETURNING id`, [ids.uni, ids.programmeDoc, admin]);
  const type = (key: string, kind: string, applies: string, min: number | null = null, max: number | null = null) => one(
    `INSERT INTO fact_types(key,label_vi,label_en,definition_vi,definition_en,value_kind,applies_to,category,min_value,max_value,created_by)
     VALUES($1,$1,$1,'Định nghĩa','Definition',$2,$3,'education',$4,$5,$6) RETURNING id`, [key, kind, applies, min, max, admin]);
  ids.tuition = await type("tuition_fee", "money", "programme");
  ids.deadline = await type("application_deadline", "date", "programme");
  ids.ielts = await type("min_ielts_overall", "number", "programme", 0, 9);
  ids.permitFee = await type("residence_permit_fee", "money", "immigration_rule");
  ids.maintenance = await type("maintenance_requirement", "money", "country");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [admin]);
  await db.exec("SET SESSION AUTHORIZATION authenticated");
  await db.query("SELECT set_extraction_account($1)", [aiAccount]);
  for (const d of [ids.programmeDoc, ids.otherDoc, ids.plainDoc]) await db.query("SELECT request_extraction($1)", [d]);
  await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE");
}, 60000);
afterAll(() => db.close());
const worker = async <T>(fn: () => Promise<T>) => {
  await db.exec("SET SESSION AUTHORIZATION extractor_login");
  try { return await fn(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
};
let run: string;
const requests: Record<string, string> = {};
type Doc = "programmeDoc" | "otherDoc" | "plainDoc";
const propose = (doc: Doc, candidate: object) => worker(() => db.query<{ r: { outcome: string; reason: string | null; fact_id: string | null } }>(
  "SELECT extractor_propose($1,$2,$3) AS r", [run, requests[doc], JSON.stringify(candidate)])).then((x) => x.rows[0].r);
const tuition = { topic: "tuition", subject: "MSc Synthetic", predicate: "tuition fee", value: "SEK 145 000 per academic year", unit: "",
  excerpt: "Tuition fee: SEK 145 000 per academic year for students outside the EU.", country: "", fact_type: "tuition_fee",
  value_number: "145000", value_currency: "sek", value_period: "year", value_date: "", confidence: 0.9 };

it("matches a page to exactly one reviewed entity by its URL, ignoring host case and a trailing slash", async () => {
  const entity = (doc: string) => db.query<{ kind: string; entity_id: string }>("SELECT * FROM document_entity($1)", [doc]).then((r) => r.rows);
  expect(await entity(ids.programmeDoc)).toEqual([expect.objectContaining({ kind: "programme", entity_id: ids.programme })]);
  expect(await entity(ids.otherDoc)).toEqual([expect.objectContaining({ kind: "university", entity_id: ids.uni })]);
  expect((await db.query<{ k: string }>("SELECT page_key('HTTPS://Www.Uni.example.test/a/b/?x=1#top') AS k")).rows[0].k).toBe("https://www.uni.example.test/a/b?x=1");
});
it("offers the worker the types for the page's entity kind plus country types", async () => {
  run = (await worker(() => db.query<{ id: string }>("SELECT extractor_start_run('local','example.test','synthetic-model','v3') AS id"))).rows[0].id;
  for (const c of (await worker(() => db.query<{ request_id: string; url: string }>("SELECT * FROM extractor_claim($1,5)", [run]))).rows) {
    requests[c.url.includes("/msc") ? "programmeDoc" : c.url.endsWith("/news") ? "otherDoc" : "plainDoc"] = c.request_id;
  }
  const keys = async (doc: Doc) => (await worker(() => db.query<{ key: string }>("SELECT key FROM extractor_fact_types($1,$2)", [run, requests[doc]]))).rows.map((r) => r.key).sort();
  expect(await keys("programmeDoc")).toEqual(["application_deadline", "maintenance_requirement", "min_ielts_overall", "tuition_fee"]);
  expect(await keys("otherDoc")).toEqual(["maintenance_requirement"]);
  expect(await keys("plainDoc")).toEqual(["maintenance_requirement"]);
  // Only the worker role may list them; the matching helpers are internal.
  await db.exec("SET SESSION AUTHORIZATION authenticated");
  try {
    await expect(db.query("SELECT * FROM extractor_fact_types($1,$2)", [run, requests.programmeDoc])).rejects.toThrow(/permission denied/);
    await expect(db.query("SELECT * FROM document_entity($1)", [ids.programmeDoc])).rejects.toThrow(/permission denied/);
  } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
});
it("stores a typed proposal linked to the page's programme, its country and the structured value", async () => {
  const r = await propose("programmeDoc", tuition);
  expect(r).toMatchObject({ outcome: "proposed", reason: null });
  const fact = (await db.query("SELECT programme_id, country_id, fact_type_id, value_number, value_currency, value_period, status, origin FROM facts WHERE id=$1", [r.fact_id])).rows[0];
  expect(fact).toEqual({ programme_id: ids.programme, country_id: ids.sweden, fact_type_id: ids.tuition, value_number: "145000", value_currency: "SEK", value_period: "year", status: "proposed", origin: "ai" });
  const ielts = await propose("programmeDoc", { ...tuition, topic: "language", predicate: "minimum IELTS", value: "IELTS Academic overall band 6.5",
    excerpt: "English requirement: IELTS Academic overall band 6.5.", fact_type: "min_ielts_overall", value_number: "6.5", value_currency: "", value_period: "" });
  expect(ielts.outcome).toBe("proposed");
  const deadline = await propose("programmeDoc", { ...tuition, topic: "deadline", predicate: "application deadline", value: "15 January 2027",
    excerpt: "Application deadline: 15 January 2027.", fact_type: "application_deadline", value_number: "", value_currency: "", value_period: "", value_date: "2027-01-15" });
  expect(deadline.outcome).toBe("proposed");
});
it("records why a typed candidate is refused, and never stores it untyped", async () => {
  const reason = async (doc: Doc, change: object) => (await propose(doc, { ...tuition, predicate: `tuition ${Math.random()}`, ...change })).reason;
  expect(await reason("otherDoc", {})).toBe("Fact type does not fit this page");
  expect(await reason("programmeDoc", { fact_type: "residence_permit_fee" })).toBe("Fact type does not fit this page");
  expect(await reason("programmeDoc", { fact_type: "no_such_type" })).toBe("Unknown or retired fact type");
  expect(await reason("programmeDoc", { value_currency: "" })).toBe("Structured value does not fit the fact type");
  expect(await reason("programmeDoc", { value_number: "145 000" })).toBe("Structured number must be digits with an optional decimal point");
  expect(await reason("programmeDoc", { value_number: "154000" })).toBe("Number 154000 not found in the excerpt");
  expect(await reason("programmeDoc", { fact_type: "", value_currency: "SEK" })).toBe("Structured value without a fact type");
  expect(await reason("programmeDoc", { country: "denmark" })).toBe("Country does not match the linked page");
  const living = { fact_type: "maintenance_requirement", value_period: "month" };
  expect(await reason("plainDoc", { ...living, country: "" })).toBe("Fact type needs a country");
  // A country type is allowed on any page; the page's entity supplies the country.
  expect((await propose("otherDoc", { ...tuition, predicate: "living cost", ...living })).outcome).toBe("proposed");
  expect((await db.query("SELECT count(*)::int AS n FROM facts WHERE fact_type_id IS NULL AND origin='ai'")).rows[0]).toEqual({ n: 0 });
});
it("still accepts untyped proposals, linked to the page's entity", async () => {
  const r = await propose("programmeDoc", { ...tuition, predicate: "scholarships", fact_type: "", value_number: "", value_currency: "", value_period: "",
    value: "SEK 145 000", excerpt: "Tuition fee: SEK 145 000 per academic year for students outside the EU." });
  expect(r.outcome).toBe("proposed");
  expect((await db.query("SELECT programme_id, fact_type_id FROM facts WHERE id=$1", [r.fact_id])).rows[0]).toEqual({ programme_id: ids.programme, fact_type_id: null });
});
it("links nothing when two reviewed entities claim the same page", async () => {
  for (const name of ["Synthetic A", "Synthetic B"]) await db.query(`INSERT INTO universities(country_id,name,official_url,document_id,evidence_excerpt,status,created_by,reviewed_at)
    VALUES($1,$2,'https://www.uni.example.test/about/',$3,'Synthetic excerpt','reviewed',$4,now())`, [ids.sweden, name, ids.plainDoc, admin]);
  expect((await db.query("SELECT * FROM document_entity($1)", [ids.plainDoc])).rows).toEqual([]);
});
