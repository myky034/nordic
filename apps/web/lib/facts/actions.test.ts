import {beforeEach,expect,it,vi} from "vitest";
const {requirePermission,rpc}=vi.hoisted(()=>({requirePermission:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/rbac/access",()=>({requirePermission,logAccessError:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import {proposeFact,reviewFact} from "@/app/(app)/facts/workspace/actions";
beforeEach(()=>{vi.clearAllMocks();requirePermission.mockResolvedValue({client:{rpc}});rpc.mockResolvedValue({error:null});});
it("checks authorization before creating or reviewing",async()=>{
 requirePermission.mockRejectedValue(new Error("access_forbidden"));
 expect((await proposeFact({},new FormData())).error).toBeDefined();
 expect((await reviewFact({},new FormData())).error).toBeDefined();
 expect(rpc).not.toHaveBeenCalled();
});
it("never forwards actor, status, source URL or retrieval date from the form",async()=>{
 const form=new FormData();form.set("document","doc");form.set("actor","forged");form.set("status","reviewed");form.set("source_url","https://example.com/forged");
 await proposeFact({},form);
 expect(requirePermission).toHaveBeenCalledWith("facts.propose");
 expect(rpc.mock.calls[0][1]).not.toHaveProperty("actor");
 expect(Object.keys(rpc.mock.calls[0][1]).sort()).toEqual(["p_document","p_topic","p_subject","p_predicate","p_value","p_unit","p_country","p_from","p_until","p_excerpt","p_university","p_programme","p_deadline_type","p_immigration_rule"].sort());
});
it("requires review capability and hides database details",async()=>{
 rpc.mockResolvedValue({error:{message:"secret connection details"}});
 const result=await reviewFact({},new FormData());
 expect(requirePermission).toHaveBeenCalledWith("facts.review");
 expect(result.error).not.toContain("secret");
});
it("forwards at most one education entity and rejects malformed links",async()=>{
 const form=new FormData();form.set("document","doc");form.set("entity","programme:11111111-1111-4111-8111-111111111111");form.set("deadlineType","rolling");
 await proposeFact({},form);
 expect(rpc.mock.calls[0][1]).toMatchObject({p_programme:"11111111-1111-4111-8111-111111111111",p_university:null,p_immigration_rule:null,p_deadline_type:"rolling"});
 for(const [entity,deadline] of [["programme:not-a-uuid",""],["country:11111111-1111-4111-8111-111111111111",""],["","sometime"]]){
   rpc.mockClear();const bad=new FormData();bad.set("entity",entity);bad.set("deadlineType",deadline);
   expect((await proposeFact({},bad)).error).toBeDefined();expect(rpc).not.toHaveBeenCalled();
 }
});
