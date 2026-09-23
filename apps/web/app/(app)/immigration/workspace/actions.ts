"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { officialUrl } from "@/lib/education/domain";
import { immigrationError, ruleTypes, type ImmigrationState } from "@/lib/immigration/domain";

const text = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" ? v.trim() : ""; };
function refresh() { revalidatePath("/immigration/workspace"); revalidatePath("/immigration"); }

// T1 / same-country / same-origin checks happen inside the RPC, where the
// document's source cannot be spoofed by the form.
export async function proposeRule(_: ImmigrationState, form: FormData): Promise<ImmigrationState> {
  try {
    const { client } = await requirePermission("immigration.manage");
    const url = officialUrl(text(form, "officialUrl"));
    const country = text(form, "country"), document = text(form, "document"), type = text(form, "ruleType");
    if (!url || !uuidPattern.test(country) || !uuidPattern.test(document) || !Object.hasOwn(ruleTypes, type)) return { error: immigrationError("immigration_invalid") };
    const { error } = await client.rpc("propose_immigration_rule", {
      p_country: country, p_rule_type: type, p_title: text(form, "title"), p_official_url: url, p_document: document, p_excerpt: text(form, "excerpt"),
    });
    if (error) throw new Error(error.message);
    refresh();
    return { message: "Đã lưu đề xuất quy định. Chưa công bố trước khi duyệt và trước khi nguồn T1 được xác minh." };
  } catch (e) { logAccessError("propose_immigration_rule"); return { error: immigrationError(e instanceof Error ? e.message : "") }; }
}

export async function reviewRule(_: ImmigrationState, form: FormData): Promise<ImmigrationState> {
  try {
    const { client } = await requirePermission("facts.review");
    const id = text(form, "id"), decision = text(form, "decision");
    if (!uuidPattern.test(id) || !["reviewed", "rejected"].includes(decision)) return { error: immigrationError("immigration_invalid") };
    const { error } = await client.rpc("review_immigration_rule", { p_id: id, p_decision: decision, p_note: text(form, "note") });
    if (error) throw new Error(error.message);
    refresh();
    return { message: "Đã ghi nhận quyết định và lịch sử." };
  } catch (e) { logAccessError("review_immigration_rule"); return { error: immigrationError(e instanceof Error ? e.message : "") }; }
}
