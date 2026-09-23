import { config } from "dotenv";
import { afterAll, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const live=process.env.RBAC_LIVE_TEST==="1";
if(live) config({path:".env.local",quiet:true});
it.skipIf(!live)("checks deployed RBAC catalogue and denied grants without assigning users",async()=>{
  const {prisma}=await import("../db");
  expect(await prisma.permission.count({where:{key:{in:["documents.read","documents.ingest","roles.manage","users.assign_roles"]}}})).toBe(4);
  expect(await prisma.role.count()).toBeGreaterThanOrEqual(3);
  const grants=await prisma.$queryRaw<{bootstrap:boolean;writes:boolean}[]>`SELECT has_function_privilege('authenticated','public.bootstrap_administrator(uuid)','EXECUTE') AS bootstrap,has_table_privilege('authenticated','public.user_roles','INSERT') AS writes`;
  expect(grants[0]).toEqual({bootstrap:false,writes:false});
  await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true)`;
    await tx.$executeRaw`SET LOCAL ROLE authenticated`;
    expect(await tx.$queryRaw`SELECT * FROM public.my_permissions()`).toEqual([]);
    expect(await tx.$queryRaw`SELECT * FROM public.access_audit`).toEqual([]);
  },{maxWait:10000,timeout:10000});
},30000);
afterAll(async()=>{if(live){const {prisma}=await import("../db");await prisma.$disconnect();}});
