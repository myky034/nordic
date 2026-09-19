"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { accessMessage, type ActionState } from "@/lib/rbac/messages";
import { IngestionError, parseDocumentInput } from "@/lib/documents/domain";
import { ingestDocument } from "@/lib/documents/ingest";

export async function importDocument(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { userId } = await requirePermission("documents.ingest");
    const payload: Record<string, unknown> = { ingestionMethod: "manual" };
    for (const key of ["sourceId", "url", "title", "documentType", "contentHash", "excerpt", "retrievedAt", "publishedAt", "sourceUpdatedAt"]) payload[key] = form.get(key) || null;
    const result = await ingestDocument(parseDocumentInput(payload), userId);
    revalidatePath("/documents");
    return { documentId: result.id, message: result.outcome === "created" ? "Đã lưu metadata. Chưa trích xuất hoặc xác minh nội dung." : "Tài liệu này đã tồn tại. Không tạo thêm bản trùng." };
  } catch (error) {
    logAccessError("document_import");
    return { error: accessMessage(error instanceof IngestionError ? error.code : error instanceof Error ? error.message : "unknown") };
  }
}
