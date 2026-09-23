"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { factError, type FactState } from "@/lib/facts/domain";
export async function proposeFact(_: FactState, form: FormData): Promise<FactState> {
  try {
    const { client } = await requirePermission("facts.propose");
    const get = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
    const { error } = await client.rpc("propose_fact", {
      p_document:get("document"),p_topic:get("topic"),p_subject:get("subject"),
      p_predicate:get("predicate"),p_value:get("value"),p_unit:get("unit") || null,
      p_country:get("country") || null,p_from:get("from") || null,p_until:get("until") || null,p_excerpt:get("excerpt"),
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
