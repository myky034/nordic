import "server-only";
import { metadataHash } from "@nordic/db/document-hash";
import { prisma } from "../db";
import { type DocumentInput, IngestionError, validateSource } from "./domain";

// Shared with the crawler (packages/db/src/document-hash.ts) so both paths
// fingerprint metadata identically. Re-exported for existing callers/tests.
export { metadataHash };

export async function ingestDocument(input: DocumentInput, actorId?: string) {
  return prisma.$transaction(async (tx) => {
    if (actorId) {
      // The actor comes only from server-verified Auth, never form data. Share
      // the RBAC lock so revocation and this insert cannot race past each other.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(918202603)`;
      await tx.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${actorId}, true)`;
      await tx.$executeRaw`SET LOCAL ROLE authenticated`;
      const result = await tx.$queryRaw<{ allowed: boolean }[]>`SELECT public.has_permission('documents.ingest') AS allowed`;
      if (!result[0]?.allowed) throw new IngestionError("access_forbidden", 403);
    }
    // The bearer token is checked at the HTTP boundary; this DB role restricts
    // the authorized service to source reads and append-only document inserts.
    await tx.$executeRaw`SET LOCAL ROLE nordic_ingestor`;
    const source = await tx.source.findUnique({ where: { id: input.sourceId } });
    validateSource(input, source);
    const fingerprint = metadataHash(input);
    const result = await tx.document.createMany({ data: [{ ...input, metadataHash: fingerprint }], skipDuplicates: true });
    // ON CONFLICT makes concurrent retries safe without catching an aborted SQL transaction.
    const document = await tx.document.findUniqueOrThrow({ where: { sourceId_canonicalUrl_contentHash: {
      sourceId: input.sourceId, canonicalUrl: input.canonicalUrl, contentHash: input.contentHash,
    } } });
    if (document.metadataHash !== fingerprint) throw new IngestionError("metadata_conflict", 409);
    return { id: document.id, outcome: result.count ? "created" as const : "unchanged" as const, processingStatus: document.processingStatus, extractionStatus: document.extractionStatus };
  }, { maxWait: 10_000, timeout: 10_000 });
}
