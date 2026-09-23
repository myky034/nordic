import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, expect, it } from "vitest";
const db=new PGlite();
const actor="11111111-1111-4111-8111-111111111111";
let document:string,first:string,second:string;
beforeAll(async()=>{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
 for(const name of ["20260917090000_countries_sources","20260918090000_documents","20260918100000_rbac","20260919090000_facts"]) await db.exec(readFileSync(`../../packages/db/prisma/migrations/${name}/migration.sql`,"utf8"));
 await db.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now())",[actor]);
 await db.query("SELECT bootstrap_administrator($1)",[actor]);
 // Synthetic metadata is confined to this disposable database.
 document=(await db.query<{id:string}>(`INSERT INTO documents(source_id,canonical_url,content_hash,metadata_hash,retrieved_at,ingestion_method)
 SELECT id,canonical_url,repeat('a',64),repeat('b',64),now(),'manual' FROM sources LIMIT 1 RETURNING id`)).rows[0].id;
},30000);
afterAll(()=>db.close());
async function role<T>(name:string,fn:()=>Promise<T>){
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[actor]);
 await db.exec("SET SESSION AUTHORIZATION "+name);
 try{return await fn();}finally{await db.exec("SET SESSION AUTHORIZATION postgres; RESET ROLE");}
}
async function propose(excerpt="Local test evidence"){
 return (await role("authenticated",()=>db.query<{id:string}>("SELECT propose_fact($1,'test','test subject','test attribute','test value',null,null,null,null,$2) AS id",[document,excerpt]))).rows[0].id;
}
it("requires evidence and rolls back the proposal on invalid evidence",async()=>{
 await expect(propose("")).rejects.toThrow();
 expect((await db.query("SELECT * FROM facts")).rows).toHaveLength(0);
 first=await propose();second=await propose();
 const e=(await db.query<{source_url:string;retrieved_at:Date}>("SELECT * FROM evidence WHERE fact_id=$1",[first])).rows[0];
 const d=(await db.query<{canonical_url:string;retrieved_at:Date}>("SELECT * FROM documents WHERE id=$1",[document])).rows[0];
 expect(e.source_url).toBe(d.canonical_url);expect(e.retrieved_at).toEqual(d.retrieved_at);
});
it("hides proposals and evidence from public; prevents direct writes",async()=>{
 await role("anon",async()=>{
 expect((await db.query("SELECT * FROM facts")).rows).toHaveLength(0);
 expect((await db.query("SELECT * FROM evidence")).rows).toHaveLength(0);
 await expect(db.query("SELECT review_fact($1,'reviewed','test',null)",[first])).rejects.toThrow(/permission denied/);
 });
 await role("authenticated",async()=>{await expect(db.exec("UPDATE facts SET status='reviewed'")).rejects.toThrow(/permission denied/);});
});
it("denies unprivileged authenticated users draft access and RPCs",async()=>{
 await role("authenticated",async()=>{
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",["22222222-2222-4222-8222-222222222222"]);
   expect((await db.query("SELECT * FROM facts")).rows).toHaveLength(0);
   expect((await db.query("SELECT * FROM evidence")).rows).toHaveLength(0);
   expect((await db.query("SELECT * FROM fact_reviews")).rows).toHaveLength(0);
   await expect(db.query("SELECT review_fact($1,'reviewed','forbidden',null)",[first])).rejects.toThrow("facts_forbidden");
 });
});
it("publishes a reviewed claim and preserves an immutable decision",async()=>{
 await role("authenticated",()=>db.query("SELECT review_fact($1,'reviewed','Checked local test evidence',null)",[first]));
 await role("anon",async()=>{expect((await db.query("SELECT * FROM facts")).rows).toHaveLength(1);expect((await db.query("SELECT * FROM evidence")).rows).toHaveLength(1);});
 await expect(role("authenticated",()=>db.query("SELECT review_fact($1,'rejected','overwrite',null)",[first]))).rejects.toThrow("facts_already_decided");
});
it("marks both sides of conflict and retains evidence and decision history",async()=>{
 await role("authenticated",()=>db.query("SELECT review_fact($1,'conflicted','Contradictory test claims',$2)",[first,second]));
 expect((await db.query("SELECT * FROM facts WHERE status='conflicted'")).rows).toHaveLength(2);
 expect((await db.query("SELECT * FROM evidence")).rows).toHaveLength(2);
 expect((await db.query("SELECT * FROM fact_reviews")).rows).toHaveLength(3);
 await expect(role("authenticated",()=>db.query("SELECT review_fact($1,'reviewed','cannot erase conflict',null)",[second]))).rejects.toThrow("facts_already_decided");
});
it("rejects invalid validity ranges and honors immediate revocation",async()=>{
 await expect(role("authenticated",()=>db.query("SELECT propose_fact($1,'t','s','p','v',null,null,'2026-12-01','2026-01-01','excerpt')",[document]))).rejects.toThrow();
 await db.exec("DELETE FROM role_permissions WHERE permission_key IN ('facts.propose','facts.review')");
 await expect(propose()).rejects.toThrow("facts_forbidden");
 await expect(role("authenticated",()=>db.query("SELECT review_fact($1,'conflicted','test',$2)",[first,second]))).rejects.toThrow("facts_forbidden");
});
