import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
const db = new PGlite();
const admin="11111111-1111-4111-8111-111111111111", member="22222222-2222-4222-8222-222222222222", second="33333333-3333-4333-8333-333333333333";
let adminRole: string, editorRole: string;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, created_at timestamptz DEFAULT now(), email_confirmed_at timestamptz, deleted_at timestamptz, banned_until timestamptz);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
  for (const migration of ["20260917090000_countries_sources","20260918090000_documents","20260918100000_rbac"]) await db.exec(readFileSync(`prisma/migrations/${migration}/migration.sql`,"utf8"));
  for (const id of [admin,member,second]) await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())",[id,id+"@example.test"]);
  adminRole=(await db.query<{id:string}>("SELECT id FROM roles WHERE name='Administrator'")).rows[0].id;
  editorRole=(await db.query<{id:string}>("SELECT id FROM roles WHERE name='Editor'")).rows[0].id;
},30000);
afterAll(async()=>{await db.close();});
async function asUser<T>(id:string,fn:()=>Promise<T>) {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec("SET SESSION AUTHORIZATION authenticated");
  try{return await fn();}finally{await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE");}
}
it("does not auto-promote signup and keeps bootstrap inaccessible to users",async()=>{
  expect((await db.query("SELECT * FROM user_roles")).rows).toHaveLength(0);
  await asUser(member,async()=>{
    expect((await db.query("SELECT * FROM my_permissions()")).rows).toHaveLength(0);
    await expect(db.query("SELECT bootstrap_administrator($1)",[member])).rejects.toThrow(/permission denied/);
    await expect(db.exec("SELECT * FROM search_access_users('')")).rejects.toThrow("rbac_forbidden");
    await expect(db.query("INSERT INTO user_roles VALUES($1,$2,now())",[member,adminRole])).rejects.toThrow(/permission denied/);
    expect((await db.query("SELECT * FROM access_audit")).rows).toHaveLength(0);
  });
});
it("owner bootstrap works once and is audited without hard-coded identity",async()=>{
  await db.query("SELECT bootstrap_administrator($1)",[admin]);
  await expect(db.query("SELECT bootstrap_administrator($1)",[second])).rejects.toThrow("rbac_already_bootstrapped");
  expect((await db.query("SELECT * FROM access_audit WHERE action='bootstrap'")).rows).toHaveLength(1);
});
it("blocks self-assignment, direct writes, and removal of final admin powers",async()=>{
  await asUser(admin,async()=>{
    await expect(db.query("SELECT assign_access_role($1,$2,false)",[admin,adminRole])).rejects.toThrow("rbac_self_assignment");
    await expect(db.query("SELECT save_access_role($1,'Administrator','',ARRAY['roles.manage'])",[adminRole])).rejects.toThrow("rbac_last_admin");
    await expect(db.exec("DELETE FROM role_permissions")).rejects.toThrow(/permission denied/);
  });
  expect((await db.query("SELECT * FROM role_permissions WHERE role_id=$1",[adminRole])).rows).toHaveLength(4);
});
it("assigns/revokes dynamically and exposes only the guarded user directory",async()=>{
  await asUser(admin,()=>db.query("SELECT assign_access_role($1,$2,true)",[member,editorRole]));
  await asUser(member,async()=>{
    expect((await db.query<{has_permission:boolean}>("SELECT has_permission('documents.ingest')")).rows[0].has_permission).toBe(true);
    expect((await db.query<{user_id:string}>("SELECT * FROM user_roles")).rows.every(r=>r.user_id===member)).toBe(true);
    await expect(db.exec("SELECT * FROM auth.users")).rejects.toThrow(/permission denied/);
    await expect(db.query("SELECT assign_access_role($1,$2,true)",[second,adminRole])).rejects.toThrow("rbac_forbidden");
  });
  await asUser(admin,()=>db.query("SELECT assign_access_role($1,$2,false)",[member,editorRole]));
  await asUser(member,async()=>{expect((await db.query<{has_permission:boolean}>("SELECT has_permission('documents.ingest')")).rows[0].has_permission).toBe(false);});
});
it("restricted managers cannot escalate themselves or delegate stronger roles",async()=>{
  const role=(await asUser(admin,()=>db.query<{save_access_role:string}>("SELECT save_access_role(null,'Limited manager','',ARRAY['roles.manage','documents.read'])"))).rows[0].save_access_role;
  await asUser(admin,()=>db.query("SELECT assign_access_role($1,$2,true)",[member,role]));
  await asUser(member,async()=>{
    await expect(db.exec("SELECT save_access_role(null,'Escalation','',ARRAY['users.assign_roles'])")).rejects.toThrow("rbac_cannot_delegate");
    await expect(db.query("SELECT save_access_role($1,'Admin tamper','',ARRAY['documents.read'])",[adminRole])).rejects.toThrow("rbac_cannot_delegate");
  });
  await asUser(admin,()=>db.query("SELECT assign_access_role($1,$2,false)",[member,role]));
});
it("protects final full manager when another operator can assign only roles",async()=>{
  const role=(await asUser(admin,()=>db.query<{save_access_role:string}>("SELECT save_access_role(null,'Assigner','',ARRAY['users.assign_roles'])"))).rows[0].save_access_role;
  await asUser(admin,()=>db.query("SELECT assign_access_role($1,$2,true)",[second,role]));
  await asUser(second,async()=>{await expect(db.query("SELECT assign_access_role($1,$2,false)",[admin,adminRole])).rejects.toThrow("rbac_cannot_delegate");});
  await expect(db.query("DELETE FROM auth.users WHERE id=$1",[admin])).rejects.toThrow(/foreign key/);
});
it("allows a deliberate handover to another full administrator",async()=>{
  await asUser(admin,()=>db.query("SELECT assign_access_role($1,$2,true)",[second,adminRole]));
  await asUser(second,()=>db.query("SELECT assign_access_role($1,$2,false)",[admin,adminRole]));
  expect((await db.query<{rbac_admin_count:string}>("SELECT rbac_admin_count()")).rows[0].rbac_admin_count).toBe(1);
  const events=await db.query("SELECT * FROM access_audit WHERE action='role.revoked'");
  expect(events.rows.length).toBeGreaterThan(0);
});
