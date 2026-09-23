import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { permit, rpc, ingest } = vi.hoisted(()=>({permit:vi.fn(),rpc:vi.fn(),ingest:vi.fn()}));
vi.mock("@/lib/rbac/access",()=>({requirePermission:permit,logAccessError:vi.fn()}));
vi.mock("@/lib/documents/ingest",()=>({ingestDocument:ingest}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { saveRole,assignRole } from "@/app/(app)/admin/access/actions";
import { importDocument } from "@/app/(app)/documents/import/actions";
import { saveSource } from "@/app/(app)/admin/sources/actions";
import { fixture } from "../documents/fixtures.test-helper";
beforeEach(()=>{vi.resetAllMocks();permit.mockResolvedValue({client:{rpc},userId:"server-verified-id"});rpc.mockResolvedValue({error:null});});
afterEach(()=>vi.restoreAllMocks());
it("checks each action's permission before calling services",async()=>{
  permit.mockRejectedValue(new Error("access_forbidden"));
  for(const action of [saveRole,assignRole,importDocument,saveSource]) expect((await action({},new FormData())).error).toBeTruthy();
  expect(rpc).not.toHaveBeenCalled();expect(ingest).not.toHaveBeenCalled();
});
it("validates malformed role IDs before RPC and maps errors safely",async()=>{
  const form=new FormData();form.set("id","bad");form.set("name","Role");form.set("description","");
  expect((await saveRole({},form)).error).toBeTruthy();expect(rpc).not.toHaveBeenCalled();
  form.set("id","");rpc.mockResolvedValue({error:{message:"postgresql://secret"}});
  expect((await saveRole({},form)).error).not.toContain("secret");
});
it("passes only permission data, never a submitted actor identity, to guarded RPC",async()=>{
  const form=new FormData();form.set("name","Editor");form.set("description","Research");form.append("permissions","documents.ingest");form.set("actorId","forged");
  expect((await saveRole({},form)).message).toBeTruthy();
  expect(rpc).toHaveBeenCalledWith("save_access_role",{p_id:null,p_name:"Editor",p_description:"Research",p_permissions:["documents.ingest"]});
});
it("rejects an invalid source URL before RPC and parses topics into an array",async()=>{
  const bad=new FormData();bad.set("name","Test");bad.set("canonicalUrl","javascript:alert(1)");bad.set("status","needs_verification");bad.set("crawlPolicy","not_reviewed");
  expect((await saveSource({},bad)).error).toBeTruthy();expect(rpc).not.toHaveBeenCalled();
  const form=new FormData();form.set("name","Udlændingestyrelsen");form.set("canonicalUrl","https://www.nyidanmark.dk/en-GB");
  form.set("status","needs_verification");form.set("crawlPolicy","not_reviewed");form.set("topics","immigration, education,,immigration");form.set("actorId","forged");
  expect((await saveSource({},form)).message).toBeTruthy();
  expect(rpc).toHaveBeenCalledWith("save_source",expect.objectContaining({p_id:null,p_topics:["immigration","education"],p_crawl_enabled:false}));
});
it("browser import uses server-verified actor and never the internal bearer token",async()=>{
  const form=new FormData();for(const [key,value] of Object.entries(fixture)) form.set(key,value);
  form.set("actorId","forged");ingest.mockResolvedValue({id:"document-id",outcome:"created"});
  expect((await importDocument({},form)).documentId).toBe("document-id");
  expect(permit).toHaveBeenCalledWith("documents.ingest");
  expect(ingest).toHaveBeenCalledWith(expect.objectContaining({ingestionMethod:"manual"}),"server-verified-id");
});
