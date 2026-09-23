import {config} from "dotenv";
import {afterAll,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
const live=process.env.FACTS_LIVE_TEST==="1";
if(live)config({path:".env.local",quiet:true});
it.skipIf(!live)("checks hosted grants and PostgREST evidence projection without writing facts",async()=>{
 const {prisma}=await import("../db");
 expect(await prisma.permission.count({where:{key:{in:["facts.propose","facts.review"]}}})).toBe(2);
 const grants=await prisma.$queryRaw<{writes:boolean;rpc:boolean}[]>`SELECT has_table_privilege('authenticated','public.facts','INSERT') AS writes,has_function_privilege('anon','public.review_fact(uuid,text,text,uuid)','EXECUTE') AS rpc`;
 expect(grants[0]).toEqual({writes:false,rpc:false});
 const {createClient}=await import("@supabase/supabase-js");
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
 const {factSelect}=await import("./view");
 const {data,error}=await client.from("facts").select(factSelect).limit(5);
 expect(error).toBeNull();
 expect(data).not.toBeNull();
 for(const row of data ?? []) expect(["reviewed","conflicted"]).toContain((row as unknown as {status:string}).status);
},30000);
afterAll(async()=>{if(live){const {prisma}=await import("../db");await prisma.$disconnect();}});
