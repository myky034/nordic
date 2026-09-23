import "server-only";
import { readPublic } from "../registry/queries";
import { uuidPattern } from "./domain";
import { pageWindow } from "../pagination";

const sourceSelect = { id: true, name: true, canonicalUrl: true, sourceTier: true, lastVerifiedAt: true } as const;
export function listDocuments() {
  return readPublic("list_documents", (tx) => tx.document.findMany({ include: { source: { select: sourceSelect } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 101 }));
}
export function getDocument(id: string) {
  if (!uuidPattern.test(id)) return Promise.resolve(null);
  return readPublic("get_document", (tx) => tx.document.findUnique({ where: { id }, include: { source: { select: sourceSelect } } }));
}
export function documentVersions(sourceId: string, canonicalUrl: string) {
  return readPublic("document_versions", (tx) => tx.document.findMany({ where: { sourceId, canonicalUrl }, select: { id: true, retrievedAt: true, contentHash: true }, orderBy: [{ retrievedAt: "desc" }, { id: "desc" }], take: 21 }));
}
/** One page of documents (newest first) with an optional title/URL search. */
export function searchDocuments(q: string, page: number) {
  const { skip, take } = pageWindow(page);
  const where = q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { canonicalUrl: { contains: q, mode: "insensitive" as const } }] } : {};
  return readPublic("search_documents", async (tx) => {
    const [rows, total] = await Promise.all([
      tx.document.findMany({ where, include: { source: { select: sourceSelect } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take }),
      tx.document.count({ where }),
    ]);
    return { rows, total };
  });
}
