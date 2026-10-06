"use server";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { classificationSystems, labourError, type LabourState } from "@/lib/labour/domain";

const text = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" ? v.trim() : ""; };
function refresh() { revalidatePath("/labour/workspace"); revalidatePath("/occupations"); }

export async function proposeOccupation(_: LabourState, form: FormData): Promise<LabourState> {
  // Messages in the editor\'s interface language (lib/i18n).
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("labour.manage");
    const document = text(form, "document"), country = text(form, "country"), system = text(form, "system"), code = text(form, "code");
    // System and code travel together; the database enforces the same rule.
    if (!uuidPattern.test(document) || (country && !uuidPattern.test(country)) || (system && !Object.hasOwn(classificationSystems, system)) || (!system !== !code)) {
      return { error: labourError("labour_invalid", locale) };
    }
    const { error } = await client.rpc("propose_occupation", {
      p_name: text(form, "name"), p_system: system || null, p_code: code || null, p_country: country || null, p_document: document, p_excerpt: text(form, "excerpt"),
    });
    if (error) throw new Error(error.message);
    refresh();
    return { message: dict.labourWorkspace.proposed };
  } catch (e) { logAccessError("propose_occupation"); return { error: labourError(e instanceof Error ? e.message : "", locale) }; }
}

export async function reviewOccupation(_: LabourState, form: FormData): Promise<LabourState> {
  // Messages in the editor\'s interface language (lib/i18n).
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("facts.review");
    const id = text(form, "id"), decision = text(form, "decision");
    if (!uuidPattern.test(id) || !["reviewed", "rejected"].includes(decision)) return { error: labourError("labour_invalid", locale) };
    const { error } = await client.rpc("review_occupation", { p_id: id, p_decision: decision, p_note: text(form, "note") });
    if (error) throw new Error(error.message);
    refresh();
    return { message: dict.editor.decisionRecorded };
  } catch (e) { logAccessError("review_occupation"); return { error: labourError(e instanceof Error ? e.message : "", locale) }; }
}
