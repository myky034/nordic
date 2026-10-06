"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { extractionError, type ExtractionState } from "@/lib/extraction/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";

// Slice 10a: an editor asks for AI extraction of ONE document. Nothing is sent
// to a model here; the scheduled worker picks the request up later.
export async function requestExtraction(_: ExtractionState, form: FormData): Promise<ExtractionState> {
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("facts.propose");
    const document = String(form.get("document") ?? "");
    if (!uuidPattern.test(document)) return { error: extractionError("extraction_invalid", locale) };
    const { error } = await client.rpc("request_extraction", { p_document: document });
    if (error) throw new Error(error.message);
    revalidatePath(`/documents/${document}`); revalidatePath("/admin/extraction");
    return { message: dict.documentEditor.requested };
  } catch (e) { logAccessError("request_extraction"); return { error: extractionError(e instanceof Error ? e.message : "", locale) }; }
}
export async function cancelExtraction(_: ExtractionState, form: FormData): Promise<ExtractionState> {
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("facts.propose");
    const request = String(form.get("request") ?? ""), document = String(form.get("document") ?? "");
    if (!uuidPattern.test(request) || !uuidPattern.test(document)) return { error: extractionError("extraction_invalid", locale) };
    const { error } = await client.rpc("cancel_extraction", { p_request: request });
    if (error) throw new Error(error.message);
    revalidatePath(`/documents/${document}`); revalidatePath("/admin/extraction");
    return { message: dict.documentEditor.cancelled };
  } catch (e) { logAccessError("cancel_extraction"); return { error: extractionError(e instanceof Error ? e.message : "", locale) }; }
}
