import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { list, get, versions } = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  versions: vi.fn(),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/form", () => ({ default: (props: { children: React.ReactNode }) => <form>{props.children}</form> }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/documents/queries", () => ({
  searchDocuments: list,
  getDocument: get,
  documentVersions: versions,
}));
// The internal-text section reads Supabase with the viewer's session; it has its own test.
vi.mock("./[id]/internal-text", () => ({ InternalText: () => null }));
vi.mock("./[id]/extraction-panel", () => ({ ExtractionPanel: () => null }));
// Signed out by default; one test signs in as a proposer.
const viewer = vi.hoisted(() => ({ perms: null as string[] | null }));
vi.mock("@/lib/rbac/viewer", () => ({ viewerPermissions: async () => viewer.perms }));
import DocumentsPage from "./page";
import DocumentPage from "./[id]/page";
it("renders an honest empty state instead of fictional documents", async () => {
  list.mockResolvedValue({ rows: [], total: 0 });
  const html = renderToStaticMarkup(await DocumentsPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }));
  expect(html).toContain("Chưa có tài liệu nào");
});
it("passes the sanitised search and page to the query and shows pagination", async () => {
  list.mockResolvedValue({ rows: [{ id: "d1", title: "Synthetic doc", retrievedAt: new Date("2026-09-19"), source: { name: "Synthetic source", sourceTier: "T1" } }], total: 60 });
  const html = renderToStaticMarkup(await DocumentsPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ q: "  kth ", page: "2" }) }));
  expect(list).toHaveBeenLastCalledWith("kth", 2);
  for (const text of ["Synthetic doc", "26–50 / 60", "Trang 2 / 3", 'href="/documents?q=kth"', 'href="/documents?q=kth&amp;page=3"']) expect(html).toContain(text);
});
it("renders escaped excerpts, attribution, unknown dates and unverified status", async () => {
  get.mockResolvedValue({
    id: "id",
    sourceId: "source",
    canonicalUrl: "https://example.com/document",
    title: "Fixture",
    excerpt: "<script>alert(1)</script>",
    retrievedAt: new Date("2026-01-01"),
    publishedAt: null,
    sourceUpdatedAt: null,
    documentType: "unknown",
    source: {
      name: "Synthetic source",
      canonicalUrl: "https://example.com/",
      sourceTier: null,
      lastVerifiedAt: null,
    },
  });
  versions.mockResolvedValue([]);
  const html = renderToStaticMarkup(
    await DocumentPage({
      params: Promise.resolve({ id: "id" }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  for (const text of [
    "Chưa có",
    "Nội dung chưa được kiểm chứng",
    "Đã lưu thông tin trang",
    "Synthetic source",
    'href="https://example.com/document"',
  ])
    expect(html).toContain(text);
});
it("shows the add-evidence shortcut only to people who can propose facts", async () => {
  get.mockResolvedValue({ id: "id", sourceId: "source", canonicalUrl: "https://example.com/document", title: "Fixture", excerpt: null,
    retrievedAt: new Date("2026-01-01"), publishedAt: null, sourceUpdatedAt: null, documentType: "unknown",
    source: { name: "Synthetic source", canonicalUrl: "https://example.com/", sourceTier: null, lastVerifiedAt: null } });
  versions.mockResolvedValue([]);
  const page = async () => renderToStaticMarkup(await DocumentPage({ params: Promise.resolve({ id: "id" }), searchParams: Promise.resolve({}) }));
  expect(await page()).not.toContain("/facts/workspace?document=id");
  viewer.perms = ["facts.review"];
  expect(await page()).not.toContain("/facts/workspace?document=id");
  viewer.perms = ["facts.propose"];
  expect(await page()).toContain("/facts/workspace?document=id");
  viewer.perms = null;
});
it("returns not found for unknown documents", async () => {
  get.mockResolvedValue(null);
  await expect(
    DocumentPage({
      params: Promise.resolve({ id: "missing" }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NOT_FOUND");
});
