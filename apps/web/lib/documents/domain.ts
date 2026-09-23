import { canonicalSourceUrl } from "../registry/domain";

export const documentTypes = ["webpage", "pdf", "text", "unknown"] as const;
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const hashPattern = /^[0-9a-f]{64}$/;
export const MAX_BODY_BYTES = 16_384;
export class IngestionError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}

export type DocumentInput = {
  sourceId: string;
  canonicalUrl: string;
  title: string | null;
  documentType: typeof documentTypes[number];
  contentHash: string;
  excerpt: string | null;
  retrievedAt: Date;
  publishedAt: Date | null;
  sourceUpdatedAt: Date | null;
  ingestionMethod: "manual" | "crawler";
};

function nullableText(value: unknown, limit: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > limit || value.includes("\0")) throw new IngestionError("invalid_text", 400);
  return value.trim() || null;
}

function timestamp(value: unknown, now: Date, required = false): Date | null {
  if ((value === null || value === undefined) && !required) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value)) throw new IngestionError("invalid_timestamp", 400);
  const date = new Date(value);
  // Round-trip the date part to reject JS's normalization of February 30, etc.
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== value.slice(0, 19) || date > now) throw new IngestionError("invalid_timestamp", 400);
  return date;
}

export function parseDocumentInput(value: unknown, now = new Date()): DocumentInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new IngestionError("invalid_payload", 400);
  const row = value as Record<string, unknown>;
  const fields = ["sourceId", "url", "title", "documentType", "contentHash", "excerpt", "retrievedAt", "publishedAt", "sourceUpdatedAt", "ingestionMethod"];
  if (Object.keys(row).some((key) => !fields.includes(key))) throw new IngestionError("unknown_field", 400);
  if (typeof row.sourceId !== "string" || !uuidPattern.test(row.sourceId)) throw new IngestionError("invalid_source_id", 400);
  if (typeof row.url !== "string" || row.url.length > 2048) throw new IngestionError("invalid_url", 400);
  const canonicalUrl = canonicalSourceUrl(row.url);
  if (!canonicalUrl || canonicalUrl.length > 2048) throw new IngestionError("invalid_url", 400);
  if (typeof row.contentHash !== "string" || !hashPattern.test(row.contentHash)) throw new IngestionError("invalid_content_hash", 400);
  const documentType = row.documentType ?? "unknown";
  if (!documentTypes.includes(documentType as typeof documentTypes[number])) throw new IngestionError("invalid_document_type", 400);
  if (row.ingestionMethod !== "manual" && row.ingestionMethod !== "crawler") throw new IngestionError("invalid_ingestion_method", 400);
  const retrievedAt = timestamp(row.retrievedAt, now, true)!;
  const publishedAt = timestamp(row.publishedAt, now);
  const sourceUpdatedAt = timestamp(row.sourceUpdatedAt, now);
  if ((publishedAt && publishedAt > retrievedAt) || (sourceUpdatedAt && sourceUpdatedAt > retrievedAt)) throw new IngestionError("invalid_date_order", 400);
  return {
    sourceId: row.sourceId.toLowerCase(), canonicalUrl, contentHash: row.contentHash,
    title: nullableText(row.title, 300), excerpt: nullableText(row.excerpt, 500),
    documentType: documentType as DocumentInput["documentType"],
    retrievedAt, publishedAt, sourceUpdatedAt, ingestionMethod: row.ingestionMethod,
  };
}

export function validateSource(input: DocumentInput, source: { canonicalUrl: string; crawlEnabled: boolean; crawlPolicy: string; status: string } | null) {
  if (!source) throw new IngestionError("source_not_registered", 422);
  if (source.crawlPolicy === "blocked") throw new IngestionError("source_blocked", 422);
  // Exact origin: neither suffix matching nor guessed subdomains establishes provenance.
  if (new URL(source.canonicalUrl).origin !== new URL(input.canonicalUrl).origin) throw new IngestionError("source_url_mismatch", 422);
  if (input.ingestionMethod === "crawler" && (!source.crawlEnabled || source.crawlPolicy !== "approved" || source.status !== "verified")) throw new IngestionError("crawl_not_enabled", 422);
}
