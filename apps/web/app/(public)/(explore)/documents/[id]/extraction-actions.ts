"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { extractionError, type ExtractionState } from "@/lib/extraction/domain";

// Slice 10a: an editor asks for AI extraction of ONE document. Nothing is sent
// to a model here; the scheduled worker picks the request up later.
export async function requestExtraction(_: ExtractionState, form: FormData): Promise<ExtractionState> {
  try {
    const { client } = await requirePermission("facts.propose");
    const document = String(form.get("document") ?? "");
    if (!uuidPattern.test(document)) return { error: extractionError("extraction_invalid") };
    const { error } = await client.rpc("request_extraction", { p_document: document });
    if (error) throw new Error(error.message);
    revalidatePath(`/documents/${document}`); revalidatePath("/admin/extraction");
    return { message: "Đã gửi yêu cầu. Đề xuất sẽ vào hàng chờ duyệt sau lần chạy tới." };
  } catch (e) { logAccessError("request_extraction"); return { error: extractionError(e instanceof Error ? e.message : "") }; }
}
export async function cancelExtraction(_: ExtractionState, form: FormData): Promise<ExtractionState> {
  try {
    const { client } = await requirePermission("facts.propose");
    const request = String(form.get("request") ?? ""), document = String(form.get("document") ?? "");
    if (!uuidPattern.test(request) || !uuidPattern.test(document)) return { error: extractionError("extraction_invalid") };
    const { error } = await client.rpc("cancel_extraction", { p_request: request });
    if (error) throw new Error(error.message);
    revalidatePath(`/documents/${document}`); revalidatePath("/admin/extraction");
    return { message: "Đã hủy yêu cầu." };
  } catch (e) { logAccessError("cancel_extraction"); return { error: extractionError(e instanceof Error ? e.message : "") }; }
}
