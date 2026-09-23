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
import DocumentsPage from "./page";
import DocumentPage from "./[id]/page";
it("renders an honest empty state instead of fictional documents", async () => {
  list.mockResolvedValue({ rows: [], total: 0 });
  const html = renderToStaticMarkup(await DocumentsPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }));
  expect(html).toContain("No documents yet");
});
it("passes the sanitised search and page to the query and shows pagination", async () => {
  list.mockResolvedValue({ rows: [{ id: "d1", title: "Synthetic doc", retrievedAt: new Date("2026-09-19"), source: { name: "Synthetic source", sourceTier: "T1" } }], total: 60 });
  const html = renderToStaticMarkup(await DocumentsPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ q: "  kth ", page: "2" }) }));
  expect(list).toHaveBeenLastCalledWith("kth", 2);
  for (const text of ["Synthetic doc", "26–50 of 60", "Page 2 of 3", 'href="/documents?q=kth"', 'href="/documents?q=kth&amp;page=3"']) expect(html).toContain(text);
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
    "Not available",
    "Claims not verified",
    "Extraction not started",
    "Synthetic source",
    'href="https://example.com/document"',
  ])
    expect(html).toContain(text);
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
