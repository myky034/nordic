import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { factBlockers, programmeBlockers, ruleBlockers } from "./visibility";

// Drift guard: lib/review/visibility.ts EXPLAINS the public RLS policies in
// TypeScript. This test builds every combination in a disposable in-memory
// database (all migrations, synthetic rows only) and checks that "no blockers"
// holds exactly when the anonymous role can read the row. If a policy changes
// and the explanation does not, this fails.
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111";
const dir = "../../packages/db/prisma/migrations";
let sweden: string;
let n = 0;

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for (const name of readdirSync(dir).filter((x) => /^\d{14}_/.test(x)).sort()) await db.exec(readFileSync(`${dir}/${name}/migration.sql`, "utf8"));
  await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [admin]);
  sweden = (await db.query<{ id: string }>("SELECT id FROM countries WHERE slug='sweden'")).rows[0].id;
}, 60000);
afterAll(() => db.close());

const id = async (sql: string, params: unknown[]) => (await db.query<{ id: string }>(sql, params)).rows[0].id;
/** A fresh source + document; the source status/tier are set afterwards so no registry rule blocks setup. */
async function document(status: string, tier: string) {
  const k = ++n;
  const source = await id("INSERT INTO sources(name,canonical_url,source_tier,country_id) VALUES('Synthetic',$1,'T1',$2) RETURNING id", [`https://s${k}.example.test/`, sweden]);
  const doc = await id(`INSERT INTO documents(source_id,canonical_url,content_hash,metadata_hash,retrieved_at,ingestion_method)
    VALUES($1,$2,repeat('a',64),repeat('b',64),now(),'manual') RETURNING id`, [source, `https://s${k}.example.test/page`]);
  return { doc, set: () => db.query("UPDATE sources SET status=$2,source_tier=$3,authority_notes='synthetic',last_verified_at=now() WHERE id=$1", [source, status, tier]) };
}
async function anonCanRead(table: string, rowId: string) {
  await db.exec("SET SESSION AUTHORIZATION anon");
  try { return (await db.query(`SELECT 1 FROM ${table} WHERE id=$1`, [rowId])).rows.length === 1; }
  finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
const sourceStates = [["verified", "T1"], ["needs_verification", "T1"], ["verified", "T2"]] as const;

it("explains an immigration rule as hidden exactly when anon cannot read it", async () => {
  for (const [status, tier] of sourceStates) {
    const d = await document(status, tier);
    const rule = await id(`INSERT INTO immigration_rules(country_id,rule_type,title,official_url,document_id,evidence_excerpt,status,created_by,reviewed_at)
      VALUES($1,'other',$2,'https://example.test/rule',$3,'Synthetic excerpt','reviewed',$4,now()) RETURNING id`, [sweden, `Rule ${n}`, d.doc, admin]);
    await d.set();
    expect(await anonCanRead("immigration_rules", rule), `${status}/${tier}`)
      .toBe(ruleBlockers({ source: { status, source_tier: tier } }).length === 0);
  }
});

it("explains a reviewed fact as hidden exactly when anon cannot read it", async () => {
  const fact = (doc: string, link: string, linkId: string | null) => id(`INSERT INTO facts(document_id,topic,subject,predicate,value,country_id,status,created_by,reviewed_at,${link})
    VALUES($1,'other','Synthetic','synthetic','1',$2,'reviewed',$3,now(),$4) RETURNING id`, [doc, sweden, admin, linkId]);
  for (const [factStatus, factTier] of sourceStates) {
    // Plain fact (the link column is set to NULL).
    const plainDoc = await document(factStatus, factTier);
    const plain = await fact(plainDoc.doc, "university_id", null);
    await plainDoc.set();
    expect(await anonCanRead("facts", plain)).toBe(factBlockers({ source: { status: factStatus, source_tier: factTier } }).length === 0);

    for (const ruleStatus of ["reviewed", "proposed"]) for (const [rs, rt] of sourceStates) {
      const ruleDoc = await document(rs, rt);
      const rule = await id(`INSERT INTO immigration_rules(country_id,rule_type,title,official_url,document_id,evidence_excerpt,status,created_by)
        VALUES($1,'other',$2,'https://example.test/rule',$3,'Synthetic excerpt',$4,$5) RETURNING id`, [sweden, `Rule ${n}`, ruleDoc.doc, ruleStatus, admin]);
      const d = await document(factStatus, factTier);
      const f = await fact(d.doc, "immigration_rule_id", rule);
      await ruleDoc.set(); await d.set();
      const blockers = factBlockers({ source: { status: factStatus, source_tier: factTier }, rule: { status: ruleStatus, source: { status: rs, source_tier: rt } } });
      expect(await anonCanRead("facts", f), `rule ${ruleStatus} ${rs}/${rt}, fact ${factStatus}`).toBe(blockers.length === 0);
    }

    for (const occupationStatus of ["reviewed", "proposed"]) {
      const d = await document(factStatus, factTier);
      const occupation = await id("INSERT INTO occupations(name,document_id,evidence_excerpt,status,created_by) VALUES($1,$2,'Synthetic excerpt',$3,$4) RETURNING id", [`Occupation ${n}`, d.doc, occupationStatus, admin]);
      const f = await fact(d.doc, "occupation_id", occupation);
      await d.set();
      const blockers = factBlockers({ source: { status: factStatus, source_tier: factTier }, occupation: { status: occupationStatus } });
      expect(await anonCanRead("facts", f), `occupation ${occupationStatus}, fact ${factStatus}`).toBe(blockers.length === 0);
    }
  }
});

it("explains a reviewed programme as hidden exactly when anon cannot read it", async () => {
  for (const universityStatus of ["reviewed", "proposed"]) {
    const d = await document("verified", "T2");
    const university = await id(`INSERT INTO universities(country_id,name,official_url,document_id,evidence_excerpt,status,created_by)
      VALUES($1,$2,'https://example.test/u',$3,'Synthetic excerpt',$4,$5) RETURNING id`, [sweden, `University ${n}`, d.doc, universityStatus, admin]);
    const programme = await id(`INSERT INTO programmes(university_id,name,degree_type,official_url,document_id,evidence_excerpt,status,created_by)
      VALUES($1,'Synthetic programme','unknown','https://example.test/p',$2,'Synthetic excerpt','reviewed',$3) RETURNING id`, [university, d.doc, admin]);
    expect(await anonCanRead("programmes", programme)).toBe(programmeBlockers({ universityStatus }).length === 0);
  }
});
