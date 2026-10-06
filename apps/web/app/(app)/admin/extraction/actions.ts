"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { extractionError, type ExtractionState } from "@/lib/extraction/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";

// The account AI proposals are attributed to. The database refuses any
// account that could review its own proposals.
export async function setExtractionAccount(_: ExtractionState, form: FormData): Promise<ExtractionState> {
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("roles.manage");
    const user = String(form.get("user") ?? "").trim();
    if (!uuidPattern.test(user)) return { error: dict.adminExtraction.enterUuid };
    const { error } = await client.rpc("set_extraction_account", { p_user: user });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/extraction");
    return { message: dict.adminExtraction.accountSaved };
  } catch (e) { logAccessError("set_extraction_account"); return { error: extractionError(e instanceof Error ? e.message : "", locale) }; }
}
