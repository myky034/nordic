"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { factError, type FactState } from "@/lib/facts/domain";
import { uuidPattern } from "@/lib/documents/domain";
import { deadlineTypes } from "@/lib/education/domain";
export async function proposeFact(_: FactState, form: FormData): Promise<FactState> {
  try {
    const { client } = await requirePermission("facts.propose");
    const get = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
    // Slice 5/6a: optional link to ONE entity, encoded as "programme:<uuid>",
    // "university:<uuid>" or "immigration_rule:<uuid>" by a single select so
    // two links cannot be sent at once.
    const [kind, entity] = get("entity").split(":");
    if (get("entity") && (!["programme","university","immigration_rule"].includes(kind) || !uuidPattern.test(entity ?? ""))) return {error:factError("facts_invalid")};
    const deadline = get("deadlineType");
    if (deadline && !Object.hasOwn(deadlineTypes, deadline)) return {error:factError("facts_invalid")};
    const { error } = await client.rpc("propose_fact", {
      p_document:get("document"),p_topic:get("topic"),p_subject:get("subject"),
      p_predicate:get("predicate"),p_value:get("value"),p_unit:get("unit") || null,
      p_country:get("country") || null,p_from:get("from") || null,p_until:get("until") || null,p_excerpt:get("excerpt"),
      p_university:kind==="university"?entity:null,p_programme:kind==="programme"?entity:null,p_deadline_type:deadline || null,p_immigration_rule:kind==="immigration_rule"?entity:null,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/facts/workspace");
    return { message: "Đã lưu đề xuất và bằng chứng. Chưa công bố trước khi duyệt." };
  } catch (e) { logAccessError("propose_fact"); return {error:factError(e instanceof Error ? e.message : "")}; }
}
export async function reviewFact(_: FactState, form: FormData): Promise<FactState> {
  try {
    const { client } = await requirePermission("facts.review");
    const { error } = await client.rpc("review_fact",{
      p_fact:form.get("fact"),p_decision:form.get("decision"),p_note:form.get("note"),p_related:form.get("related") || null,
    });
    if(error) throw new Error(error.message);
    revalidatePath("/facts/workspace"); revalidatePath("/facts");
    return {message:"Đã ghi nhận quyết định và lịch sử."};
  } catch(e) { logAccessError("review_fact"); return {error:factError(e instanceof Error ? e.message : "")}; }
}
