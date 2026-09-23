import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
const db = new PGlite();
const admin = "11111111-1111-4111-8111-111111111111", member = "22222222-2222-4222-8222-222222222222";
let denmark: string;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, created_at timestamptz DEFAULT now(), email_confirmed_at timestamptz, deleted_at timestamptz, banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
  for (const migration of ["20260917090000_countries_sources", "20260918100000_rbac", "20260919100000_sources_manage"]) {
    await db.exec(readFileSync(`../../packages/db/prisma/migrations/${migration}/migration.sql`, "utf8"));
  }
  for (const id of [admin, member]) await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())", [id]);
  await db.query("SELECT bootstrap_administrator($1)", [admin]);
  denmark = (await db.query<{ id: string }>("SELECT id FROM countries WHERE slug='denmark'")).rows[0].id;
}, 30000);
afterAll(() => db.close());
async function asUser<T>(id: string | null, fn: () => Promise<T>) {
  if (id) await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`SET SESSION AUTHORIZATION ${id ? "authenticated" : "anon"}`);
  try { return await fn(); } finally { await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE"); }
}
let urlCounter = 0;
function save(overrides: Record<string, unknown> = {}) {
  const p = {
    id: null, name: "Udlændingestyrelsen", url: `https://www.nyidanmark.dk/en-GB?case=${++urlCounter}`, country: denmark,
    tier: "T1", type: "government", topics: ["immigration"], language: "en",
    notes: null, status: "needs_verification", policy: "not_reviewed", crawlEnabled: false,
    frequency: null, freeNotes: null, ...overrides,
  };
  return db.query<{ save_source: string }>(
    "SELECT save_source($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) AS save_source",
    [p.id, p.name, p.url, p.country, p.tier, p.type, p.topics, p.language, p.notes, p.status, p.policy, p.crawlEnabled, p.frequency, p.freeNotes],
  );
}
it("denies unpermitted authenticated users and anonymous callers", async () => {
  await asUser(member, async () => { await expect(save()).rejects.toThrow("sources_forbidden"); });
  await asUser(null, async () => { await expect(save()).rejects.toThrow(/permission denied/); });
});
it("rejects an invalid canonical URL before touching the table", async () => {
  await asUser(admin, async () => {
    await expect(save({ url: "javascript:alert(1)" })).rejects.toThrow("sources_invalid");
  });
});
it("requires authority notes before accepting verified status, and stamps the date itself", async () => {
  await asUser(admin, async () => {
    await expect(save({ status: "verified" })).rejects.toThrow("sources_verification_requires_notes");
    const before = Date.now();
    const id = (await save({ status: "verified", notes: "Checked against the official .dk domain." })).rows[0].save_source;
    const row = (await db.query<{ last_verified_at: Date }>("SELECT last_verified_at FROM sources WHERE id=$1", [id])).rows[0];
    expect(row.last_verified_at.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(row.last_verified_at.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
it("refuses to enable crawling before the source is approved and verified", async () => {
  await asUser(admin, async () => {
    await expect(save({ crawlEnabled: true })).rejects.toThrow("sources_crawl_requires_approval");
    await expect(save({ crawlEnabled: true, policy: "approved" })).rejects.toThrow("sources_crawl_requires_approval");
    const id = (await save({
      crawlEnabled: true, policy: "approved", status: "verified", notes: "Reviewed official immigration authority.",
    })).rows[0].save_source;
    const row = (await db.query<{ crawl_enabled: boolean }>("SELECT crawl_enabled FROM sources WHERE id=$1", [id])).rows[0];
    expect(row.crawl_enabled).toBe(true);
  });
});
it("edits an existing row in place and records before/after in the audit log", async () => {
  await asUser(admin, async () => {
    const id = (await save({ name: "Draft entry" })).rows[0].save_source;
    await save({ id, name: "Udlændingestyrelsen (Danish Immigration Service)" });
    const row = (await db.query<{ name: string }>("SELECT name FROM sources WHERE id=$1", [id])).rows[0];
    expect(row.name).toBe("Udlændingestyrelsen (Danish Immigration Service)");
    const auditRows = (await db.query<{ details: unknown }>(
      "SELECT details FROM access_audit WHERE action='source.saved' AND target_id=$1", [id],
    )).rows.map((r) => (typeof r.details === "string" ? JSON.parse(r.details) : r.details) as { before: { name: string } | null; after: { name: string } });
    const details = auditRows.find((d) => d.before !== null)!;
    expect(details.before?.name).toBe("Draft entry");
    expect(details.after.name).toBe("Udlændingestyrelsen (Danish Immigration Service)");
  });
});
it("still exposes new rows through the public read policy, never through direct writes", async () => {
  const id = (await asUser(admin, () => save({ name: "Public visibility check" }))).rows[0].save_source;
  await asUser(null, async () => {
    expect((await db.query("SELECT id FROM sources WHERE id=$1", [id])).rows).toHaveLength(1);
    await expect(db.exec(`UPDATE sources SET name='hacked' WHERE id='${id}'`)).rejects.toThrow(/permission denied/i);
  });
});
