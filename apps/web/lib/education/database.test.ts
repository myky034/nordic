import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
// Every row below is synthetic and lives only in this disposable in-memory
// database. Nothing here is seeded to, or describes, a real institution.
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
let document: string, sweden: string, denmark: string;
let university: string, programme: string;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for (const name of ["20260917090000_countries_sources", "20260918090000_documents", "20260918100000_rbac", "20260919090000_facts",
    "20260919100000_sources_manage", "20260923090000_fact_conflict_requires_review", "20260923100000_education"]) {
    await db.exec(readFileSync(`../../packages/db/prisma/migrations/${name}/migration.sql`, "utf8"));
  }
  for (const id of [admin, member]) await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await db.query("SELECT bootstrap_administrator($1)", [admin]);
  document = (await db.query<{ id: string }>(`INSERT INTO documents(source_id,canonical_url,content_hash,metadata_hash,retrieved_at,ingestion_method)
  SELECT id,canonical_url,repeat('a',64),repeat('b',64),now(),'manual' FROM sources LIMIT 1 RETURNING id`)).rows[0].id;
  sweden = (await db.query<{ id: string }>("SELECT id FROM countries WHERE slug='sweden'")).rows[0].id;
  denmark = (await db.query<{ id: string }>("SELECT id FROM countries WHERE slug='denmark'")).rows[0].id;
}, 30000);
afterAll(() => db.close());
async function as<T>(id: string | null, fn: () => Promise<T>) {
  if (id) await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`SET SESSION AUTHORIZATION ${id ? "authenticated" : "anon"}`);
  try { return await fn(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
const proposeUniversity = (name = "Test University A", country = sweden, excerpt = "Synthetic excerpt naming the test university.") =>
  db.query<{ id: string }>("SELECT propose_university($1,$2,'https://uni.example.test/',$3,$4) AS id", [country, name, document, excerpt]);
const proposeProgramme = (uni: string, name = "Test Programme", degree = "master") =>
  db.query<{ id: string }>("SELECT propose_programme($1,$2,$3,'test field','English','https://uni.example.test/p',null,$4,'Synthetic programme excerpt.') AS id", [uni, name, degree, document]);
const review = (kind: string, id: string, decision = "reviewed") =>
  db.query("SELECT review_education($1,$2,$3,'Checked synthetic evidence')", [kind, id, decision]);

it("grants education.manage to complete administrators only", async () => {
  const rows = (await db.query<{ name: string }>(`SELECT r.name FROM roles r JOIN role_permissions rp ON rp.role_id=r.id WHERE rp.permission_key='education.manage'`)).rows;
  expect(rows.map((r) => r.name)).toEqual(["Administrator"]);
});
it("denies proposals without permission and direct table writes", async () => {
  await as(member, async () => {
    await expect(proposeUniversity()).rejects.toThrow("education_forbidden");
    await expect(db.exec(`INSERT INTO universities(country_id,name,official_url,document_id,evidence_excerpt,created_by) VALUES('${sweden}','x','https://x.test/','${document}','x','${member}')`)).rejects.toThrow(/permission denied/);
  });
  await as(null, async () => { await expect(proposeUniversity()).rejects.toThrow(/permission denied/); });
});
it("requires an existing document and non-empty evidence", async () => {
  await as(admin, async () => {
    await expect(db.query("SELECT propose_university($1,'X','https://x.test/','33333333-3333-4333-8333-333333333333','e')", [sweden])).rejects.toThrow("education_document_missing");
    await expect(proposeUniversity("Empty evidence", sweden, "   ")).rejects.toThrow("education_invalid");
    await expect(db.query("SELECT propose_university($1,'X','javascript:alert(1)',$2,'e')", [sweden, document])).rejects.toThrow("education_invalid");
  });
  expect((await db.query("SELECT * FROM universities")).rows).toHaveLength(0);
});
it("keeps proposals private until reviewed, and deduplicates live names", async () => {
  university = (await as(admin, () => proposeUniversity())).rows[0].id;
  await expect(as(admin, () => proposeUniversity("test university a"))).rejects.toThrow("education_duplicate");
  // Same name in another country is a different entity.
  await as(admin, () => proposeUniversity("Test University A", denmark));
  await as(null, async () => { expect((await db.query("SELECT * FROM universities")).rows).toHaveLength(0); });
  await as(member, async () => { expect((await db.query("SELECT * FROM universities")).rows).toHaveLength(0); });
  await as(admin, async () => { expect((await db.query("SELECT * FROM universities")).rows).toHaveLength(2); });
});
it("does not publish a programme before its university is reviewed", async () => {
  programme = (await as(admin, () => proposeProgramme(university))).rows[0].id;
  await expect(as(admin, () => proposeProgramme(university, "Bad degree", "diploma"))).rejects.toThrow("education_invalid");
  await expect(as(admin, () => review("programme", programme))).rejects.toThrow("education_university_unreviewed");
  await as(admin, () => review("university", university));
  await as(admin, () => review("programme", programme));
  await as(null, async () => {
    expect((await db.query("SELECT * FROM universities")).rows).toHaveLength(1);
    expect((await db.query("SELECT * FROM programmes")).rows).toHaveLength(1);
    await expect(db.query("SELECT * FROM education_reviews")).rejects.toThrow(/permission denied/);
  });
  await expect(as(admin, () => review("programme", programme, "rejected"))).rejects.toThrow("education_already_decided");
  expect((await db.query("SELECT decision FROM education_reviews")).rows).toHaveLength(2);
});
it("allows a corrected proposal after rejection without deleting history", async () => {
  const other = (await as(admin, () => proposeUniversity("Test University B"))).rows[0].id;
  await as(admin, () => review("university", other, "rejected"));
  await expect(as(admin, () => proposeProgramme(other))).rejects.toThrow("education_invalid");
  await as(admin, () => proposeUniversity("Test University B"));
  expect((await db.query("SELECT * FROM universities WHERE name='Test University B'")).rows).toHaveLength(2);
});
it("links tuition/deadline facts to a programme and inherits its country", async () => {
  const fact = (await as(admin, () => db.query<{ id: string }>(
    "SELECT propose_fact($1,'education','Test Programme','application deadline','rolling',null,null,null,null,'Synthetic deadline excerpt',null,$2,'rolling') AS id",
    [document, programme]))).rows[0].id;
  const row = (await db.query<{ country_id: string; programme_id: string; deadline_type: string }>("SELECT * FROM facts WHERE id=$1", [fact])).rows[0];
  expect(row).toMatchObject({ country_id: sweden, programme_id: programme, deadline_type: "rolling" });
  await expect(as(admin, () => db.query("SELECT propose_fact($1,'education','s','p','v',null,$2,null,null,'e',null,$3,null)", [document, denmark, programme]))).rejects.toThrow("facts_country_mismatch");
  await expect(as(admin, () => db.query("SELECT propose_fact($1,'education','s','p','v',null,null,null,null,'e',null,$2,'sometime')", [document, programme]))).rejects.toThrow("facts_invalid");
  await expect(as(admin, () => db.query("SELECT propose_fact($1,'education','s','p','v',null,null,null,null,'e',$2,$3,null)", [document, university, programme]))).rejects.toThrow("facts_invalid");
  // Existing 10-argument callers keep working.
  await as(admin, () => db.query("SELECT propose_fact($1,'t','s','p','v',null,null,null,null,'e')", [document]));
});
it("hides review permission from education editors who lack facts.review", async () => {
  await db.query("INSERT INTO roles(name) VALUES('Education editor')");
  await db.query("INSERT INTO role_permissions(role_id,permission_key) SELECT id,'education.manage' FROM roles WHERE name='Education editor'");
  await db.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='Education editor'", [member]);
  const id = (await as(member, () => proposeUniversity("Test University C"))).rows[0].id;
  await expect(as(member, () => review("university", id))).rejects.toThrow("education_forbidden");
});
