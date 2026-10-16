import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// L7b-0 (KHLOE-166): withdraw_fact() takes back a reviewed or conflicted fact with a note and
// an append-only fact_reviews row. Disposable in-memory database, every migration, synthetic rows.
// PGlite is ONE connection, so true concurrency is verified separately against real PostgreSQL
// (packages/db/scripts/verify-withdraw-fact.pg.mjs); here we check the lock calls exist.
const db = new PGlite();
const dir = "../../packages/db/prisma/migrations";
const U = {
  admin: "11111111-1111-4111-8111-111111111111", // bootstrap administrator: has facts.review
  proposer: "44444444-4444-4444-8444-444444444444", // facts.propose only
  member: "55555555-5555-4555-8555-555555555555", // signed in, no permission
};
const FN = "public.withdraw_fact(uuid,text,uuid)";
let document: string;
let sweden: string;

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for (const name of readdirSync(dir).filter((x) => /^\d{14}_/.test(x)).sort()) await db.exec(readFileSync(`${dir}/${name}/migration.sql`, "utf8"));
  for (const id of Object.values(U)) await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await db.query("SELECT bootstrap_administrator($1)", [U.admin]);
  const role = (await db.query<{ id: string }>("INSERT INTO roles(name,description) VALUES('Test proposer','synthetic') RETURNING id")).rows[0].id;
  await db.query("INSERT INTO role_permissions(role_id,permission_key) VALUES($1,'facts.propose')", [role]);
  await db.query("INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)", [U.proposer, role]);
  sweden = (await db.query<{ id: string }>("SELECT id FROM countries WHERE slug='sweden'")).rows[0].id;
  const source = (await db.query<{ id: string }>(`INSERT INTO sources(name,canonical_url,source_tier,status,authority_notes,last_verified_at,country_id)
    VALUES('Synthetic','https://withdraw.example.test/','T1','verified','synthetic',now(),$1) RETURNING id`, [sweden])).rows[0].id;
  document = (await db.query<{ id: string }>(`INSERT INTO documents(source_id,canonical_url,content_hash,metadata_hash,retrieved_at,ingestion_method)
    VALUES($1,'https://withdraw.example.test/page',repeat('a',64),repeat('b',64),now(),'manual') RETURNING id`, [source])).rows[0].id;
}, 60000);
afterAll(() => db.close());

/** Runs fn as a PostgREST-like caller: anon, or authenticated with the given user id. */
async function as<T>(who: keyof typeof U | "anon", fn: () => Promise<T>) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [who === "anon" ? "" : U[who]]);
  await db.exec(`SET SESSION AUTHORIZATION ${who === "anon" ? "anon" : "authenticated"}`);
  try { return await fn(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
async function fact(status: string, extra = "") {
  return (await db.query<{ id: string }>(`INSERT INTO facts(document_id,topic,subject,predicate,value,country_id,status,created_by,reviewed_at${extra ? "," + extra : ""})
    VALUES($1,'other','Synthetic','synthetic','1',$2,$3,$4,${status === "proposed" || status === "rejected" ? "NULL" : "now()"}${extra ? ",now()" : ""}) RETURNING id`,
  [document, sweden, status, U.admin])).rows[0].id;
}
const withdraw = (who: keyof typeof U | "anon", id: string, note: string | null, related: string | null = null) =>
  as(who, () => db.query("SELECT withdraw_fact($1,$2,$3)", [id, note, related]));
const state = async (id: string) => (await db.query<{ status: string; reviewed_at: Date | null }>("SELECT status,reviewed_at FROM facts WHERE id=$1", [id])).rows[0];
const reviews = async (id: string) =>
  (await db.query<{ decision: string; note: string; actor_id: string; related_fact_id: string | null }>("SELECT decision,note,actor_id,related_fact_id FROM fact_reviews WHERE fact_id=$1 ORDER BY created_at", [id])).rows;

describe("authorized withdrawal", () => {
  it("withdraws a reviewed fact: rejected, review time kept, one audited row with the caller and trimmed note", async () => {
    const f = await fact("reviewed");
    const reviewedAt = (await state(f)).reviewed_at;
    expect(reviewedAt).not.toBeNull();
    await withdraw("admin", f, "  Source page no longer states this.  ");
    // Same as resolve_source_change('superseded'): the original review time stays (PR #7 review M1).
    expect(await state(f)).toEqual({ status: "rejected", reviewed_at: reviewedAt });
    expect(await reviews(f)).toEqual([{ decision: "withdrawn", note: "Source page no longer states this.", actor_id: U.admin, related_fact_id: null }]);
  });

  it("withdraws a conflicted fact, leaving its counterpart conflicted", async () => {
    const a = await fact("conflicted"), b = await fact("conflicted");
    await withdraw("admin", a, "Duplicate of the kept fact", b);
    expect((await state(a)).status).toBe("rejected");
    expect((await state(b)).status).toBe("conflicted");
    expect((await reviews(a))[0]).toMatchObject({ decision: "withdrawn", related_fact_id: b });
  });

  it("accepts a reviewed related fact and a 1000-character note", async () => {
    const f = await fact("reviewed"), kept = await fact("reviewed");
    await withdraw("admin", f, "x".repeat(1000), kept);
    expect((await reviews(f))[0].related_fact_id).toBe(kept);
  });

  it("leaves the kept fact's choice to the reviewer: another page, fact type and entity are accepted", async () => {
    // PR #7 review M2: documented decision. Duplicates exist across pages and sources (shared
    // university pages, national portals) and between typed and untyped facts, so the database
    // does not enforce an equivalence rule; it only requires the kept fact to be published.
    const otherSource = (await db.query<{ id: string }>(`INSERT INTO sources(name,canonical_url,source_tier,status,authority_notes,last_verified_at,country_id)
      VALUES('Synthetic 2','https://withdraw-2.example.test/','T2','verified','synthetic',now(),$1) RETURNING id`, [sweden])).rows[0].id;
    const otherDoc = (await db.query<{ id: string }>(`INSERT INTO documents(source_id,canonical_url,content_hash,metadata_hash,retrieved_at,ingestion_method)
      VALUES($1,'https://withdraw-2.example.test/other',repeat('c',64),repeat('d',64),now(),'manual') RETURNING id`, [otherSource])).rows[0].id;
    const type = (await db.query<{ id: string }>(`INSERT INTO fact_types(key,label_vi,label_en,definition_vi,definition_en,value_kind,applies_to,category,created_by)
      VALUES('withdraw_test_type','Loại thử','Test type','Định nghĩa','Definition','text','programme','education',$1) RETURNING id`, [U.admin])).rows[0].id;
    const kept = (await db.query<{ id: string }>(`INSERT INTO facts(document_id,topic,subject,predicate,value,status,created_by,reviewed_at,fact_type_id,country_id)
      VALUES($1,'other','Different subject','different','2','reviewed',$2,now(),$3,$4) RETURNING id`, [otherDoc, U.admin, type, sweden])).rows[0].id;
    const f = await fact("reviewed");
    await withdraw("admin", f, "Duplicate stated on another page", kept);
    expect((await reviews(f))[0]).toMatchObject({ decision: "withdrawn", related_fact_id: kept });
    // Withdrawing the kept fact later is allowed; the earlier link stays as history.
    await withdraw("admin", kept, "Kept fact withdrawn too");
    expect((await reviews(f))[0].related_fact_id).toBe(kept);
  });

  it("hides a withdrawn fact from the public", async () => {
    const f = await fact("reviewed");
    expect((await as("anon", () => db.query("SELECT 1 FROM facts WHERE id=$1", [f]))).rows).toHaveLength(1);
    await withdraw("admin", f, "Withdrawn for test");
    expect((await as("anon", () => db.query("SELECT 1 FROM facts WHERE id=$1", [f]))).rows).toHaveLength(0);
  });
});

describe("refusals leave the fact and its history untouched", () => {
  async function refused(who: keyof typeof U | "anon", f: string, note: string | null, error: RegExp | string, related: string | null = null) {
    const before = { state: await state(f), reviews: await reviews(f) };
    await expect(withdraw(who, f, note, related)).rejects.toThrow(error);
    expect({ state: await state(f), reviews: await reviews(f) }).toEqual(before);
  }

  it("refuses anon (no EXECUTE), a member and a proposer (no facts.review)", async () => {
    const f = await fact("reviewed");
    await refused("anon", f, "Not allowed", /permission denied/);
    await refused("member", f, "Not allowed", "facts_forbidden");
    await refused("proposer", f, "Not allowed", "facts_forbidden");
  });

  it("refuses a missing, empty, whitespace-only or over-long note", async () => {
    const f = await fact("reviewed");
    for (const note of [null, "", "   ", "\n\t", " \r\n\f ", "x".repeat(1001)]) await refused("admin", f, note, "facts_invalid");
  });

  it("stores the note trimmed of edge line breaks, keeping inner ones", async () => {
    const f = await fact("reviewed");
    await withdraw("admin", f, "\n\tLine one\nLine two\r\n");
    expect((await reviews(f))[0].note).toBe("Line one\nLine two");
  });

  it("refuses a repeated withdrawal", async () => {
    const f = await fact("reviewed");
    await withdraw("admin", f, "First withdrawal");
    await refused("admin", f, "Second withdrawal", "facts_not_withdrawable");
    expect(await reviews(f)).toHaveLength(1);
  });

  it("refuses proposed and rejected facts, and an unknown id", async () => {
    await refused("admin", await fact("proposed"), "Not published", "facts_not_withdrawable");
    await refused("admin", await fact("rejected"), "Not published", "facts_not_withdrawable");
    await expect(withdraw("admin", "99999999-9999-4999-8999-999999999999", "Missing")).rejects.toThrow("facts_missing");
  });

  it("refuses a fact with a pending source change (resolve_source_change owns that decision)", async () => {
    await refused("admin", await fact("reviewed", "source_changed_at"), "Pending change", "facts_source_change_pending");
  });

  it("refuses a related fact that is itself, unknown, or not published", async () => {
    const f = await fact("reviewed");
    await refused("admin", f, "Self", "facts_invalid", f);
    await refused("admin", f, "Unknown", "facts_invalid", "99999999-9999-4999-8999-999999999999");
    await refused("admin", f, "Proposed", "facts_invalid", await fact("proposed"));
    await refused("admin", f, "Rejected", "facts_invalid", await fact("rejected"));
  });

  it("rolls the fact back when the audit insert fails", async () => {
    const f = await fact("reviewed");
    // Test-only trigger, as superuser: the audit row cannot be written, so nothing may change.
    await db.exec(`CREATE FUNCTION public.test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_unavailable'; END $$;
      CREATE TRIGGER test_fail_audit BEFORE INSERT ON public.fact_reviews FOR EACH ROW EXECUTE FUNCTION public.test_fail_audit();`);
    try {
      await refused("admin", f, "Audit will fail", "audit_unavailable");
    } finally {
      await db.exec("DROP TRIGGER test_fail_audit ON public.fact_reviews; DROP FUNCTION public.test_fail_audit();");
    }
    await withdraw("admin", f, "Audit works again");
    expect((await state(f)).status).toBe("rejected");
  });
});

describe("permissions and function safety", () => {
  it("grants EXECUTE to authenticated only", async () => {
    const can = async (role: string) =>
      (await db.query<{ ok: boolean }>("SELECT has_function_privilege($1,$2,'EXECUTE') AS ok", [role, FN])).rows[0].ok;
    expect(await can("authenticated")).toBe(true);
    for (const role of ["anon", "service_role", "nordic_crawler_ops", "nordic_extractor_ops"]) expect(await can(role), role).toBe(false);
    const acl = (await db.query<{ acl: string }>("SELECT proacl::text AS acl FROM pg_proc WHERE oid=$1::regprocedure", [FN])).rows[0].acl;
    expect(acl).not.toMatch(/(^|[{,])=X/); // no PUBLIC entry
  });

  it("is SECURITY DEFINER with an empty search_path", async () => {
    const p = (await db.query<{ prosecdef: boolean; proconfig: string[] }>("SELECT prosecdef,proconfig FROM pg_proc WHERE oid=$1::regprocedure", [FN])).rows[0];
    expect(p.prosecdef).toBe(true);
    expect(p.proconfig).toEqual(['search_path=""']);
  });

  it("ignores a caller's search_path: a shadow has_permission() cannot grant access", async () => {
    await db.exec(`CREATE SCHEMA evil; CREATE FUNCTION evil.has_permission(text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
      GRANT USAGE ON SCHEMA evil TO authenticated; GRANT EXECUTE ON FUNCTION evil.has_permission(text) TO authenticated;`);
    try {
      const f = await fact("reviewed");
      await expect(as("member", async () => {
        await db.exec("SET search_path = evil, public");
        try { return await db.query("SELECT public.withdraw_fact($1,'Hijack attempt',null)", [f]); } finally { await db.exec("RESET search_path"); }
      })).rejects.toThrow("facts_forbidden");
      expect((await state(f)).status).toBe("reviewed");
    } finally {
      await db.exec("DROP SCHEMA evil CASCADE");
    }
  });

  it("takes the shared and review advisory locks (same as review_fact)", async () => {
    const src = (await db.query<{ src: string }>("SELECT prosrc AS src FROM pg_proc WHERE oid=$1::regprocedure", [FN])).rows[0].src;
    expect(src).toContain("pg_advisory_xact_lock_shared(918202603)");
    expect(src).toContain("pg_advisory_xact_lock(919202604)");
    expect(src).toMatch(/FROM public\.facts WHERE id = p_fact FOR UPDATE/);
  });

  it("keeps fact_reviews readable only by editors and unwritable directly", async () => {
    const f = await fact("reviewed");
    await withdraw("admin", f, "Visible to editors");
    // anon has no SELECT grant at all; a signed-in member has the grant but RLS returns nothing.
    await expect(as("anon", () => db.query("SELECT 1 FROM fact_reviews WHERE fact_id=$1", [f]))).rejects.toThrow(/permission denied/);
    expect((await as("member", () => db.query("SELECT 1 FROM fact_reviews WHERE fact_id=$1", [f]))).rows).toHaveLength(0);
    expect((await as("proposer", () => db.query("SELECT 1 FROM fact_reviews WHERE fact_id=$1", [f]))).rows).toHaveLength(1);
    await expect(as("admin", () => db.query("INSERT INTO fact_reviews(fact_id,actor_id,decision,note) VALUES($1,$2,'withdrawn','direct')", [f, U.admin])))
      .rejects.toThrow(/permission denied/);
    await expect(as("admin", () => db.query("DELETE FROM fact_reviews WHERE fact_id=$1", [f]))).rejects.toThrow(/permission denied/);
  });
});

describe("existing behaviour is unchanged", () => {
  it("still accepts every earlier decision and rejects unknown or NULL ones", async () => {
    const f = await fact("reviewed");
    for (const decision of ["reviewed", "rejected", "conflicted", "revalidated", "superseded", "withdrawn"])
      await db.query("INSERT INTO fact_reviews(fact_id,actor_id,decision,note) VALUES($1,$2,$3,'check')", [f, U.admin, decision]);
    await expect(db.query("INSERT INTO fact_reviews(fact_id,actor_id,decision,note) VALUES($1,$2,'deleted','check')", [f, U.admin])).rejects.toThrow(/fact_reviews_decision_check/);
    await expect(db.query("INSERT INTO fact_reviews(fact_id,actor_id,decision,note) VALUES($1,$2,NULL,'check')", [f, U.admin])).rejects.toThrow(/null value/);
  });

  it("review_fact still decides proposals and still refuses a withdrawn fact", async () => {
    const p = await fact("proposed");
    await as("admin", () => db.query("SELECT review_fact($1,'reviewed','Checked',null)", [p]));
    expect((await state(p)).status).toBe("reviewed");
    await withdraw("admin", p, "Taken back");
    await expect(as("admin", () => db.query("SELECT review_fact($1,'reviewed','Re-publish',null)", [p]))).rejects.toThrow("facts_already_decided");
    expect((await reviews(p)).map((r) => r.decision)).toEqual(["reviewed", "withdrawn"]);
  });
});
