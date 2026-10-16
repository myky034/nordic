// Real-PostgreSQL verification of migration 20261016100000_withdraw_fact (L7b-0, KHLOE-166).
//
// Why this exists next to the PGlite tests: PGlite is a single in-process connection, so it cannot
// show two transactions racing. This script runs against a real PostgreSQL server with two
// connections. It is NOT part of `npm test` and NEVER targets the shared Supabase database:
//
//   VERIFY_PG_URL=postgres://postgres:pw@127.0.0.1:54329/postgres node packages/db/scripts/verify-withdraw-fact.pg.mjs
//
// Safety rules enforced below:
// - the host must be localhost / 127.0.0.1 / ::1 (a disposable local server you started yourself);
// - the URL must not equal DATABASE_URL or DIRECT_URL;
// - the server must be a fresh cluster (the migrations create cluster-wide roles), else it stops;
// - it creates its own database, applies every migration, checks, and drops that database.
import { readdirSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import pg from "pg";

const raw = process.env.VERIFY_PG_URL;
if (!raw) throw new Error("Set VERIFY_PG_URL to a disposable LOCAL PostgreSQL server (see header).");
if ([process.env.DATABASE_URL, process.env.DIRECT_URL].includes(raw)) throw new Error("Refusing: VERIFY_PG_URL equals an application database URL.");
const base = new URL(raw);
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(base.hostname)) throw new Error(`Refusing non-local host ${base.hostname}.`);

const migrations = fileURLToPath(new URL("../prisma/migrations/", import.meta.url));
const dbName = `nordic_verify_${randomBytes(4).toString("hex")}`;
const U = { admin: "11111111-1111-4111-8111-111111111111", member: "55555555-5555-4555-8555-555555555555" };
const FN = "public.withdraw_fact(uuid,text,uuid)";
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", `${name}: ${e.message}`]); }
};

const admin = new pg.Client({ connectionString: raw });
await admin.connect();
const fresh = await admin.query("SELECT count(*)::int AS n FROM pg_roles WHERE rolname IN ('nordic_crawler_ops','nordic_extractor_ops')");
if (fresh.rows[0].n !== 0) throw new Error("Refusing: Nordic roles already exist on this server. Use a fresh disposable cluster.");
const version = (await admin.query("SELECT version() AS v")).rows[0].v;
await admin.query(`CREATE DATABASE ${dbName}`);

const url = new URL(raw); url.pathname = `/${dbName}`;
const connect = async () => { const c = new pg.Client({ connectionString: url.toString() }); await c.connect(); return c; };
const a = await connect(), b = await connect();
/** Acts like a PostgREST request: role authenticated (or anon), JWT subject set for this session. */
const as = async (c, who) => {
  await c.query("RESET ROLE");
  await c.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [who === "anon" ? "" : U[who]]);
  await c.query(`SET ROLE ${who === "anon" ? "anon" : "authenticated"}`);
};
const reset = (c) => c.query("RESET ROLE");

try {
  // Supabase provides these; a plain server does not. Same prelude as the PGlite tests.
  await a.query(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  const names = readdirSync(migrations).filter((x) => /^\d{14}_/.test(x)).sort();
  for (const name of names) await a.query(readFileSync(`${migrations}/${name}/migration.sql`, "utf8"));
  assert.equal(names.at(-1), "20261016100000_withdraw_fact");
  results.push(["PASS", `applied ${names.length} migrations, last ${names.at(-1)}`]);

  for (const id of Object.values(U)) await a.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await a.query("SELECT bootstrap_administrator($1)", [U.admin]);
  const sweden = (await a.query("SELECT id FROM countries WHERE slug='sweden'")).rows[0].id;
  const source = (await a.query(`INSERT INTO sources(name,canonical_url,source_tier,status,authority_notes,last_verified_at,country_id)
    VALUES('Synthetic','https://verify.example.test/','T1','verified','synthetic',now(),$1) RETURNING id`, [sweden])).rows[0].id;
  const document = (await a.query(`INSERT INTO documents(source_id,canonical_url,content_hash,metadata_hash,retrieved_at,ingestion_method)
    VALUES($1,'https://verify.example.test/page',repeat('a',64),repeat('b',64),now(),'manual') RETURNING id`, [source])).rows[0].id;
  const fact = async (status) => (await a.query(`INSERT INTO facts(document_id,topic,subject,predicate,value,country_id,status,created_by,reviewed_at)
    VALUES($1,'other','Synthetic','synthetic','1',$2,$3,$4,${status === "proposed" ? "NULL" : "now()"}) RETURNING id`, [document, sweden, status, U.admin])).rows[0].id;
  const status = async (id) => (await a.query("SELECT status FROM facts WHERE id=$1", [id])).rows[0].status;
  const withdrawals = async (id) => (await a.query("SELECT count(*)::int AS n FROM fact_reviews WHERE fact_id=$1 AND decision='withdrawn'", [id])).rows[0].n;
  const rejects = async (promise, pattern) => { await assert.rejects(promise, pattern); };

  await check("authorized withdrawal of a reviewed fact", async () => {
    const f = await fact("reviewed");
    await as(a, "admin"); await a.query("SELECT withdraw_fact($1,$2,null)", [f, "Real PG check"]); await reset(a);
    assert.equal(await status(f), "rejected"); assert.equal(await withdrawals(f), 1);
  });
  await check("authorized withdrawal of a conflicted fact", async () => {
    const f = await fact("conflicted");
    await as(a, "admin"); await a.query("SELECT withdraw_fact($1,'Real PG check',null)", [f]); await reset(a);
    assert.equal(await status(f), "rejected");
  });
  await check("unauthorized: anon has no EXECUTE, member gets facts_forbidden", async () => {
    const f = await fact("reviewed");
    await as(a, "anon"); await rejects(a.query("SELECT withdraw_fact($1,'x',null)", [f]), /permission denied/); await reset(a);
    await as(a, "member"); await rejects(a.query("SELECT withdraw_fact($1,'x',null)", [f]), /facts_forbidden/); await reset(a);
    assert.equal(await status(f), "reviewed"); assert.equal(await withdrawals(f), 0);
  });
  await check("missing / empty / whitespace / over-long note refused", async () => {
    const f = await fact("reviewed");
    await as(a, "admin");
    for (const note of [null, "", "   ", "\n\t", "x".repeat(1001)]) await rejects(a.query("SELECT withdraw_fact($1,$2,null)", [f, note]), /facts_invalid/);
    await reset(a);
    assert.equal(await status(f), "reviewed");
  });
  await check("repeated withdrawal refused", async () => {
    const f = await fact("reviewed");
    await as(a, "admin"); await a.query("SELECT withdraw_fact($1,'first',null)", [f]);
    await rejects(a.query("SELECT withdraw_fact($1,'second',null)", [f]), /facts_not_withdrawable/); await reset(a);
    assert.equal(await withdrawals(f), 1);
  });
  await check("audit insert failure rolls the fact back", async () => {
    const f = await fact("reviewed");
    await a.query(`CREATE FUNCTION public.test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_unavailable'; END $$;
      CREATE TRIGGER test_fail_audit BEFORE INSERT ON public.fact_reviews FOR EACH ROW EXECUTE FUNCTION public.test_fail_audit();`);
    try {
      await as(a, "admin"); await rejects(a.query("SELECT withdraw_fact($1,'x',null)", [f]), /audit_unavailable/); await reset(a);
    } finally { await reset(a); await a.query("DROP TRIGGER test_fail_audit ON public.fact_reviews; DROP FUNCTION public.test_fail_audit();"); }
    assert.equal(await status(f), "reviewed"); assert.equal(await withdrawals(f), 0);
  });
  await check("EXECUTE only for authenticated; SECURITY DEFINER; search_path=''", async () => {
    const can = async (r) => (await a.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS ok", [r, FN])).rows[0].ok;
    assert.equal(await can("authenticated"), true);
    for (const r of ["anon", "service_role", "nordic_crawler_ops", "nordic_extractor_ops", "public"]) assert.equal(await can(r), false, r);
    const p = (await a.query("SELECT prosecdef, proconfig FROM pg_proc WHERE oid=$1::regprocedure", [FN])).rows[0];
    assert.equal(p.prosecdef, true); assert.deepEqual(p.proconfig, ['search_path=""']);
  });
  await check("search_path hijack: a shadow has_permission() is ignored", async () => {
    await a.query(`CREATE SCHEMA evil; CREATE FUNCTION evil.has_permission(text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
      GRANT USAGE ON SCHEMA evil TO authenticated; GRANT EXECUTE ON FUNCTION evil.has_permission(text) TO authenticated;`);
    const f = await fact("reviewed");
    try {
      await as(a, "member"); await a.query("SET search_path = evil, public");
      await rejects(a.query("SELECT public.withdraw_fact($1,'hijack',null)", [f]), /facts_forbidden/);
    } finally { await a.query("RESET search_path"); await reset(a); await a.query("DROP SCHEMA evil CASCADE"); }
    assert.equal(await status(f), "reviewed");
  });

  // Concurrency (needs two connections; PGlite cannot do this).
  const waitUntilBlocked = async (pid) => {
    for (let i = 0; i < 100; i++) {
      const r = await admin.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [pid]);
      if (r.rows[0]?.wait_event_type === "Lock") return;
      await new Promise((ok) => setTimeout(ok, 50));
    }
    throw new Error("second transaction never waited on a lock");
  };
  const pidB = (await b.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;

  await check("concurrent withdrawals of the same fact: second waits, then is refused; one audit row", async () => {
    const f = await fact("reviewed");
    await as(a, "admin"); await as(b, "admin");
    await a.query("BEGIN"); await a.query("SELECT withdraw_fact($1,'session A',null)", [f]);
    const second = b.query("SELECT withdraw_fact($1,'session B',null)", [f]).then(() => "ok", (e) => e.message);
    await waitUntilBlocked(pidB);
    await a.query("COMMIT");
    assert.equal(await second, "facts_not_withdrawable");
    await reset(a); await reset(b);
    assert.equal(await status(f), "rejected"); assert.equal(await withdrawals(f), 1);
  });
  await check("concurrent cross-withdrawal (each names the other as kept): second is refused", async () => {
    const f1 = await fact("reviewed"), f2 = await fact("reviewed");
    await as(a, "admin"); await as(b, "admin");
    await a.query("BEGIN"); await a.query("SELECT withdraw_fact($1,'dup of f2',$2)", [f1, f2]);
    const second = b.query("SELECT withdraw_fact($1,'dup of f1',$2)", [f2, f1]).then(() => "ok", (e) => e.message);
    await waitUntilBlocked(pidB);
    await a.query("COMMIT");
    assert.equal(await second, "facts_invalid"); // f1 is no longer published, so it cannot be the kept fact
    await reset(a); await reset(b);
    assert.equal(await status(f1), "rejected"); assert.equal(await status(f2), "reviewed");
  });
  await check("withdrawal racing review_fact on another fact is serialized by the review lock", async () => {
    const f = await fact("reviewed"), p = await fact("proposed");
    await as(a, "admin"); await as(b, "admin");
    await a.query("BEGIN"); await a.query("SELECT withdraw_fact($1,'session A',null)", [f]);
    const second = b.query("SELECT review_fact($1,'reviewed','session B',null)", [p]).then(() => "ok", (e) => e.message);
    await waitUntilBlocked(pidB);
    await a.query("COMMIT");
    assert.equal(await second, "ok");
    await reset(a); await reset(b);
    assert.equal(await status(f), "rejected"); assert.equal(await status(p), "reviewed");
  });
  await check("rolled-back withdrawal leaves no trace", async () => {
    const f = await fact("reviewed");
    await as(a, "admin"); await a.query("BEGIN"); await a.query("SELECT withdraw_fact($1,'will roll back',null)", [f]); await a.query("ROLLBACK"); await reset(a);
    assert.equal(await status(f), "reviewed"); assert.equal(await withdrawals(f), 0);
  });

  // Last: the forward-fix, on this throwaway database only. It must remove the function and keep
  // every fact state and every 'withdrawn' audit row.
  await check("forward-fix removes withdraw_fact() and preserves facts and withdrawn history", async () => {
    const snapshot = async () => (await a.query(`SELECT (SELECT json_agg(x ORDER BY x.id) FROM (SELECT id,status FROM facts) x) AS facts,
      (SELECT json_agg(r ORDER BY r.id) FROM (SELECT id,fact_id,decision,note FROM fact_reviews) r) AS reviews`)).rows[0];
    const before = await snapshot();
    assert.ok(before.reviews.some((r) => r.decision === "withdrawn"));
    await a.query(readFileSync(fileURLToPath(new URL("../prisma/recovery/20261016100000_withdraw_fact.forward-fix.sql", import.meta.url)), "utf8"));
    assert.equal((await a.query("SELECT to_regprocedure($1) AS p", [FN])).rows[0].p, null);
    assert.deepEqual(await snapshot(), before);
    const f = await fact("reviewed"); // the kept CHECK still accepts history rows
    await a.query("INSERT INTO fact_reviews(fact_id,actor_id,decision,note) VALUES($1,$2,'withdrawn','history row')", [f, U.admin]);
  });
} finally {
  await a.end().catch(() => {}); await b.end().catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch((e) => results.push(["FAIL", `drop ${dbName}: ${e.message}`]));
  await admin.end();
}

console.log(`Server: ${version}`);
console.log(`Database: ${dbName} (created and dropped by this run)`);
for (const [s, n] of results) console.log(`${s}  ${n}`);
const failed = results.filter(([s]) => s === "FAIL").length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
