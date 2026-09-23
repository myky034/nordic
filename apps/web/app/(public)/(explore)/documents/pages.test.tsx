import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { list, get, versions } = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), versions: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/documents/queries", () => ({ listDocuments: list, getDocument: get, documentVersions: versions }));
import DocumentsPage from "./page";
import DocumentPage from "./[id]/page";
it("renders an honest empty state instead of fictional documents", async () => {
  list.mockResolvedValue([]);
  const html = renderToStaticMarkup(await DocumentsPage());
  expect(html).toContain("No documents yet");
});
it("renders escaped excerpts, attribution, unknown dates and unverified status", async () => {
  get.mockResolvedValue({ id: "id", sourceId: "source", canonicalUrl: "https://example.com/document", title: "Fixture", excerpt: "<script>alert(1)</script>", retrievedAt: new Date("2026-01-01"), publishedAt: null, sourceUpdatedAt: null, documentType: "unknown", source: { name: "Synthetic source", canonicalUrl: "https://example.com/", sourceTier: null, lastVerifiedAt: null } });
  versions.mockResolvedValue([]);
  const html = renderToStaticMarkup(await DocumentPage({ params: Promise.resolve({ id: "id" }), searchParams: Promise.resolve({}) }));
  expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>");
  for (const text of ["Not available", "Claims not verified", "Extraction not started", "Synthetic source", 'href="https://example.com/document"']) expect(html).toContain(text);
});
it("returns not found for unknown documents", async () => {
  get.mockResolvedValue(null);
  await expect(DocumentPage({ params: Promise.resolve({ id: "missing" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
});
