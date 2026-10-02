import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { getSource, searchSources, perms } = vi.hoisted(() => ({ getSource: vi.fn(), searchSources: vi.fn(), perms: { value: null as string[] | null } }));
vi.mock("@/lib/rbac/viewer", () => ({ viewerPermissions: async () => perms.value }));
// Detail pages ask whether the visitor bookmarked the item; render as a guest here.
vi.mock("@/lib/workspace/saved", () => ({ savedState: async () => ({ signedIn: false, saved: false }) }));
vi.mock("@/components/save-button", () => ({ SaveButton: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/registry/queries", () => ({ getSource, searchSources }));
vi.mock("@/components/key-nav", () => ({ KeyNav: () => null }));
import SourcePage from "./[id]/page";
import SourcesPage from "./page";
const base = {
  id: "s1", name: "Synthetic source", canonicalUrl: "https://example.com/", sourceTier: null, sourceType: null, topics: [], language: null,
  authorityNotes: null, status: "needs_verification", crawlEnabled: false, crawlPolicy: "not_reviewed", crawlFrequency: null,
  lastCrawledAt: null, lastVerifiedAt: null, notes: null, country: null, documents: [], _count: { documents: 0 },
};
const render = async () => renderToStaticMarkup(await SourcePage({ params: Promise.resolve({ id: "s1" }), searchParams: Promise.resolve({}) }));

it("shows registry metadata with unknowns stated, and the original link; crawl and internal notes only to editors", async () => {
  getSource.mockResolvedValue({ ...base, notes: "Internal synthetic note" });
  perms.value = null;
  const html = await render();
  expect(html).toContain('href="https://example.com/"');
  for (const text of ["Chưa phân loại", "Chưa có", "Chưa xác minh", "Chưa gán quốc gia", "Xác minh gần nhất", "Chưa có tài liệu nào được nhập"]) expect(html).toContain(text);
  for (const text of ["Đang tắt", "Tần suất crawl", "Lần crawl gần nhất", "Căn cứ xác minh", "Internal synthetic note"]) expect(html).not.toContain(text);
  perms.value = ["sources.manage"];
  const editor = await render();
  for (const text of ["Đang tắt", "Tần suất crawl", "Căn cứ xác minh", "Chưa kiểm tra", "Internal synthetic note"]) expect(editor).toContain(text);
  perms.value = null;
});
it("never renders an unsafe URL as a link and 404s unknown sources", async () => {
  getSource.mockResolvedValue({ ...base, canonicalUrl: "javascript:alert(1)" });
  const html = await render();
  expect(html).not.toContain("javascript:");
  expect(html).toContain("URL nguồn cần được xác minh");
  getSource.mockResolvedValue(null);
  await expect(render()).rejects.toThrow("NOT_FOUND");
});

const list = async (q: Record<string, string> = {}) => renderToStaticMarkup(await SourcesPage({ params: Promise.resolve({}), searchParams: Promise.resolve(q) }));
const id = "11111111-1111-4111-8111-111111111111";

it("lists sources as a table whose rows open the Inspector and keep the filters", async () => {
  searchSources.mockResolvedValue({ rows: [{ ...base, id, sourceTier: "T1", country: { name: "Sweden", slug: "sweden" } }], total: 1 });
  getSource.mockResolvedValue(null);
  const html = await list({ tier: "T1" });
  expect(html).toContain("<table");
  expect(html).toContain(`href="/sources?tier=T1&amp;source=${id}"`);
  for (const v of ["Synthetic source", "Thụy Điển", "example.com"]) expect(html).toContain(v);
  expect(html).not.toContain('role="dialog"');
});
it("opens the selected source beside the list, with a link to its own page", async () => {
  searchSources.mockResolvedValue({ rows: [{ ...base, id }], total: 1 });
  getSource.mockResolvedValue({ ...base, id });
  const html = await list({ source: id });
  for (const v of ['role="dialog"', "Xác minh gần nhất", "Chưa có tài liệu nào được nhập", `href="/sources/${id}"`, 'href="/sources"']) expect(html).toContain(v);
});
