import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
// PR 1.5 entry point: the document page links editors and crawler operators to
// the read-only structure preview, and nobody else.
const { perms } = vi.hoisted(() => ({ perms: vi.fn() }));
vi.mock("@/lib/rbac/viewer", () => ({ viewerPermissions: perms }));
vi.mock("./internal-text", () => ({ InternalText: () => null }));
vi.mock("./extraction-panel", () => ({ ExtractionPanel: () => null }));
vi.mock("@/lib/documents/queries", () => ({
  getDocument: async () => ({ id: "d1", sourceId: "s1", canonicalUrl: "https://uni.example.test/p", title: "Synthetic page", excerpt: null, retrievedAt: new Date("2026-10-10T08:00:00Z"),
    publishedAt: null, sourceUpdatedAt: null, documentType: "webpage", source: { name: "Synthetic university", canonicalUrl: "https://uni.example.test/", sourceTier: "T2", lastVerifiedAt: null } }),
  documentVersions: async () => [],
}));
import Page from "./page";

const html = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "d1" }) } as never));
it("shows the structure link to editors and crawler operators only", async () => {
  for (const p of [["documents.ingest"], ["facts.propose"], ["crawler.manage"]]) {
    perms.mockResolvedValue(p);
    expect(await html()).toContain('href="/admin/crawler/documents/d1"');
  }
  for (const p of [null, [], ["documents.read"]]) {
    perms.mockResolvedValue(p);
    expect(await html()).not.toContain("/admin/crawler/documents/");
  }
});
