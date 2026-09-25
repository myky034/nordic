import { createHash } from "node:crypto";

// Shared by the web ingestion API and the crawler so both compute identical
// fingerprints; a drift here would break deduplication between the two paths.
export type HashableDocument = {
  title: string | null;
  documentType: string;
  excerpt: string | null;
  publishedAt: Date | null;
  sourceUpdatedAt: Date | null;
};

/** Fingerprint of the descriptive metadata (retrieval time/method excluded). */
export function metadataHash<T extends HashableDocument>(input: T) {
  return createHash("sha256").update(JSON.stringify([
    input.title, input.documentType, input.excerpt,
    input.publishedAt?.toISOString() ?? null, input.sourceUpdatedAt?.toISOString() ?? null,
  ])).digest("hex");
}

/**
 * `sha256-text-v1`: SHA-256 of normalised extracted text (Unicode NFC,
 * whitespace runs collapsed, trimmed). Used for crawled pages so rotating
 * tokens in the raw HTML do not create a new version on every fetch.
 */
export function normaliseText(text: string) {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}
export function textHash(text: string) {
  return createHash("sha256").update(normaliseText(text), "utf8").digest("hex");
}
