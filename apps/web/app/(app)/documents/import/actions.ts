"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { accessMessage, type ActionState } from "@/lib/rbac/messages";
import { IngestionError, parseDocumentInput } from "@/lib/documents/domain";
import { ingestDocument } from "@/lib/documents/ingest";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export async function importDocument(_state: ActionState, form: FormData): Promise<ActionState> {
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { userId } = await requirePermission("documents.ingest");
    const payload: Record<string, unknown> = { ingestionMethod: "manual" };
    for (const key of ["sourceId", "url", "title", "documentType", "contentHash", "excerpt", "retrievedAt", "publishedAt", "sourceUpdatedAt"]) payload[key] = form.get(key) || null;
    const result = await ingestDocument(parseDocumentInput(payload), userId);
    revalidatePath("/documents");
    return { documentId: result.id, message: result.outcome === "created" ? dict.documentEditor.created : dict.documentEditor.duplicate };
  } catch (error) {
    logAccessError("document_import");
    return { error: accessMessage(error instanceof IngestionError ? error.code : error instanceof Error ? error.message : "unknown", locale) };
  }
}
