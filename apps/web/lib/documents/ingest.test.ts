import { beforeEach, expect, it, vi } from "vitest";
const { tx } = vi.hoisted(() => ({ tx: {
  $executeRaw: vi.fn(), $queryRaw: vi.fn(), source: { findUnique: vi.fn() }, document: { createMany: vi.fn(), findUniqueOrThrow: vi.fn() },
} }));
vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ prisma: { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) } }));
import { ingestDocument, metadataHash } from "./ingest";
import { parseDocumentInput } from "./domain";
import { fixture } from "./fixtures.test-helper";
const input = parseDocumentInput(fixture);
beforeEach(() => {
  vi.resetAllMocks();
  tx.source.findUnique.mockResolvedValue({ canonicalUrl: "https://example.com/", crawlEnabled: false, crawlPolicy: "not_reviewed", status: "needs_verification" });
  tx.document.createMany.mockResolvedValue({ count: 1 });
  tx.document.findUniqueOrThrow.mockResolvedValue({ id: "id", metadataHash: metadataHash(input), processingStatus: "stored", extractionStatus: "not_started" });
});
it("uses restricted role and conflict-safe insert", async () => {
  expect(await ingestDocument(input)).toMatchObject({ outcome: "created" });
  expect(tx.$executeRaw.mock.calls[0][0][0]).toBe("SET LOCAL ROLE nordic_ingestor");
  expect(tx.document.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
});
it("deduplicates retries but rejects inconsistent metadata without updating history", async () => {
  tx.document.createMany.mockResolvedValue({ count: 0 });
  expect(await ingestDocument(input)).toMatchObject({ outcome: "unchanged" });
  await expect(ingestDocument({ ...input, title: "conflicting title" })).rejects.toThrow("metadata_conflict");
});
it("metadata hash ignores retry time but detects descriptive changes", () => {
  expect(metadataHash(input)).toBe(metadataHash({ ...input, retrievedAt: new Date(), ingestionMethod: "crawler" }));
  expect(metadataHash(input)).not.toBe(metadataHash({ ...input, excerpt: "new" }));
});
it("does not write when source eligibility fails", async () => {
  await expect(ingestDocument({ ...input, ingestionMethod: "crawler" })).rejects.toThrow("crawl_not_enabled");
  expect(tx.document.createMany).not.toHaveBeenCalled();
});


it("rechecks browser permission under the RBAC transaction lock before inserting", async () => {
  tx.$queryRaw.mockResolvedValue([{ allowed: false }]);
  await expect(ingestDocument(input, "11111111-1111-4111-8111-111111111111")).rejects.toThrow("access_forbidden");
  expect(tx.document.createMany).not.toHaveBeenCalled();
  expect(tx.$executeRaw.mock.calls[0][0][0]).toContain("pg_advisory_xact_lock_shared");
});
it("allows a permission-bearing browser actor without changing the internal API path", async () => {
  tx.$queryRaw.mockResolvedValue([{ allowed: true }]);
  expect(await ingestDocument(input, "11111111-1111-4111-8111-111111111111")).toMatchObject({ outcome: "created" });
});
