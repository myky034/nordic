import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { getCountry, result, perms } = vi.hoisted(() => ({ getCountry: vi.fn(), result: { data: [] as unknown[], error: null as unknown }, perms: { value: null as string[] | null } }));
// Which buttons appear depends on the viewer's permissions (lib/rbac/ui.ts).
vi.mock("@/lib/rbac/viewer", () => ({ viewerPermissions: async () => perms.value }));
// Detail pages ask whether the visitor bookmarked the item; render as a guest here.
vi.mock("@/lib/workspace/saved", () => ({ savedState: async () => ({ signedIn: false, saved: false }) }));
vi.mock("@/components/save-button", () => ({ SaveButton: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/registry/queries", () => ({ getCountry }));
vi.mock("@/lib/rbac/access", () => ({ logAccessError: vi.fn() }));
// A minimal chainable Supabase query-builder stand-in: every filter/order/limit
// call returns the same thenable object, matching how the real client's
// PostgrestFilterBuilder can be awaited directly at any point in the chain.
// The client itself (before .from()) must stay a plain, non-thenable object,
// or `await createClient()` would unwrap straight to `result`.
function builder(): Record<string, unknown> {
  const self: Record<string, unknown> = { then: (resolve: (v: unknown) => void) => resolve(result) };
  for (const method of ["select", "eq", "in", "not", "order", "limit"]) self[method] = () => self;
  return self;
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => builder() }) }));
import CountryPage from "./[slug]/page";

it("returns not found for an unregistered country", async () => {
  getCountry.mockResolvedValue(null);
  await expect(CountryPage({ params: Promise.resolve({ slug: "atlantis" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
});
it("shows an honest empty state instead of an invented country profile", async () => {
  getCountry.mockResolvedValue({ id: "c1", slug: "sweden", name: "Sweden", status: "needs_research", sources: [] });
  result.data = []; result.error = null;
  const html = renderToStaticMarkup(await CountryPage({ params: Promise.resolve({ slug: "sweden" }), searchParams: Promise.resolve({}) }));
  expect(html).toContain("Chưa có thông tin nào được duyệt");
  expect(html).not.toContain("Country profile data is not available yet");
  // A visitor is not sent into the editors' workspace, nor shown the research status.
  expect(html).not.toContain("/facts/workspace");
  expect(html).not.toContain("Đang thu thập dữ liệu");
});
it("points editors to the facts workspace from the empty state", async () => {
  getCountry.mockResolvedValue({ id: "c1", slug: "sweden", name: "Sweden", status: "needs_research", sources: [] });
  result.data = []; result.error = null; perms.value = ["facts.propose"];
  const html = renderToStaticMarkup(await CountryPage({ params: Promise.resolve({ slug: "sweden" }), searchParams: Promise.resolve({}) }));
  perms.value = null;
  expect(html).toContain('href="/facts/workspace"');
  expect(html).toContain("Đang thu thập dữ liệu");
});
it("renders reviewed facts scoped to this country instead of the placeholder", async () => {
  getCountry.mockResolvedValue({ id: "c1", slug: "sweden", name: "Sweden", status: "active", sources: [] });
  result.data = [{
    id: "f1", document_id: "d1", topic: "immigration", subject: "Student residence permit", predicate: "processing time",
    value: "up to", unit: "weeks", status: "reviewed", valid_from: null, valid_until: null, reviewed_at: "2026-09-19T00:00:00Z",
    evidence: { source_url: "https://www.migrationsverket.se/en.html", excerpt: "Excerpt text.", retrieved_at: "2026-09-19T00:00:00Z" },
    documents: { title: "Migrationsverket page", sources: { name: "Migrationsverket", source_tier: "T1" } },
  }];
  result.error = null;
  const html = renderToStaticMarkup(await CountryPage({ params: Promise.resolve({ slug: "sweden" }), searchParams: Promise.resolve({}) }));
  expect(html).toContain("Student residence permit");
  expect(html).toContain("Migrationsverket");
  expect(html).not.toContain("Chưa có thông tin nào được duyệt");
});
it("fails closed on a database error instead of showing a silently empty profile", async () => {
  getCountry.mockResolvedValue({ id: "c1", slug: "sweden", name: "Sweden", status: "active", sources: [] });
  result.data = []; result.error = { message: "connection refused" };
  await expect(CountryPage({ params: Promise.resolve({ slug: "sweden" }), searchParams: Promise.resolve({}) })).rejects.toThrow();
});

it("says per topic that nothing is reviewed yet instead of showing empty cards, and links to the country's sources", async () => {
  const source = { id: "11111111-1111-4111-8111-111111111111", name: "Synthetic agency", canonicalUrl: "https://agency.example.test/", sourceTier: "T1", status: "verified", lastVerifiedAt: null };
  getCountry.mockResolvedValue({ id: "c1", slug: "denmark", name: "Denmark", status: "needs_research", sources: [source] });
  result.data = []; result.error = null;
  const html = renderToStaticMarkup(await CountryPage({ params: Promise.resolve({ slug: "denmark" }), searchParams: Promise.resolve({ group: "permits" }) }));
  for (const v of ["Chưa có nội dung nào được duyệt", "1/1 nguồn đã xác minh", 'href="/sources?country=denmark"', "Chưa có trường nào được duyệt", "Chưa có quy định nào được duyệt",
    "Chưa có số liệu lao động nào được duyệt", 'href="/immigration?country=denmark"',
    "Học phí &amp; chi phí", "Visa &amp; giấy phép", "Lương &amp; việc làm", 'href="/countries/denmark?group=work"',
    // ?group=permits was asked for: its question is the open tab.
    "Cần visa, giấy phép gì?", "Chưa có thông tin nào được duyệt cho câu hỏi này"]) expect(html).toContain(v);
  // The source list itself lives on /sources, not on the country page.
  // "Thông tin khác" appears only when it holds something.
  for (const v of ["Synthetic agency", "Nguồn của quốc gia này", "Học ở đây tốn bao nhiêu?", ">Khác<"]) expect(html).not.toContain(v);
});
