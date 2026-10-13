import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { calls, results } = vi.hoisted(() => ({ calls: [] as unknown[][], results: [] as { data: unknown; error: unknown }[] }));
// Detail pages ask whether the visitor bookmarked the item; render as a guest here.
vi.mock("@/lib/workspace/saved", () => ({ savedState: async () => ({ signedIn: false, saved: false }) }));
vi.mock("@/lib/rbac/viewer", () => ({ viewerPermissions: async () => null }));
vi.mock("@/components/save-button", () => ({ SaveButton: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock("next/form", () => ({ default: (props: { children: React.ReactNode }) => <form>{props.children}</form> }));
vi.mock("@/lib/rbac/access", () => ({ logAccessError: vi.fn() }));
// Chainable Supabase stand-in: records every filter call; each .from() takes
// the next queued result.
function builder(result: { data: unknown; error: unknown }): Record<string, unknown> {
  const self: Record<string, unknown> = { then: (resolve: (v: unknown) => void) => resolve(result) };
  for (const m of ["select", "eq", "in", "ilike", "order", "limit", "range", "maybeSingle"]) self[m] = (...args: unknown[]) => { calls.push([m, ...args]); return self; };
  return self;
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => builder(results.shift()!) }) }));
import ProgrammesPage from "./page";
import ProgrammePage from "./[id]/page";
const id = "11111111-1111-4111-8111-111111111111";
const programme = {
  id, name: "Synthetic Programme", degree_type: "master", field: null, language: null, official_url: "https://uni.example.test/p",
  application_url: null, evidence_excerpt: "Synthetic excerpt.", reviewed_at: "2026-09-20T00:00:00Z",
  universities: { id, name: "Synthetic University", official_url: "https://uni.example.test/", status: "reviewed", countries: { slug: "sweden", name: "Sweden" } },
  documents: { canonical_url: "https://source.example.test/doc", retrieved_at: "2026-09-19T00:00:00Z", title: null, sources: { name: "Synthetic source", source_tier: "T2" } },
};

it("applies only allowlisted filters and always restricts to reviewed rows", async () => {
  calls.length = 0; results.push({ data: [], error: null });
  const html = renderToStaticMarkup(await ProgrammesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ country: "sweden", degree: "diploma", field: "50%" }) }));
  expect(calls).toContainEqual(["eq", "status", "reviewed"]);
  expect(calls).toContainEqual(["eq", "universities.status", "reviewed"]);
  expect(calls).toContainEqual(["eq", "universities.countries.slug", "sweden"]);
  expect(calls).toContainEqual(["ilike", "field", "%50\\%%"]);
  expect(calls.some((c) => c[1] === "degree_type")).toBe(false);
  expect(html).toContain("Chưa có chương trình đã kiểm tra nào khớp");
});
it("leads with the official page and the university's description, and lists what is not available yet", async () => {
  results.push({ data: programme, error: null }, { data: [], error: null }, { data: [{ key: "tuition_fee", label_vi: "Học phí (loại)", label_en: "Tuition (type)" }], error: null });
  const html = renderToStaticMarkup(await ProgrammePage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }));
  for (const text of ["Synthetic Programme", "Synthetic University", "Mở trang chương trình chính thức", "Synthetic excerpt.", "Synthetic source", "Tổ chức", "2026-09-19", "Nguồn không nêu",
    "Thông tin chính", "Học phí (loại)", "Hạn nộp hồ sơ", "IELTS tối thiểu", "Chưa có", "xem trên trang chính thức"]) expect(html).toContain(text);
  // The description comes before the checklist, which comes before the summary.
  expect(html.indexOf("Synthetic excerpt.")).toBeLessThan(html.indexOf("Thông tin chính"));
  expect(html.indexOf("Thông tin chính")).toBeLessThan(html.indexOf("Tóm tắt"));
});
it("fills a slot from a typed fact, showing the structured value and the source's own wording (L3b)", async () => {
  const tuition = {
    id: "f1", document_id: "d1", topic: "tuition", subject: "Synthetic Programme", predicate: "tuition fee", value: "SEK 145 000 per year", unit: null,
    status: "reviewed", valid_from: null, valid_until: null, reviewed_at: "2026-10-01T00:00:00Z",
    fact_types: { key: "tuition_fee", label_vi: "Học phí", label_en: "Tuition fee" }, value_number: "145000", value_currency: "SEK", value_period: "year", value_date: null,
    evidence: { source_url: "https://uni.example.test/p", excerpt: "Tuition fee: SEK 145 000 per year.", retrieved_at: "2026-09-30T00:00:00Z" },
    documents: { title: null, sources: { name: "Synthetic source", source_tier: "T2" } },
  };
  results.push({ data: programme, error: null }, { data: [tuition], error: null }, { data: [], error: null });
  const html = renderToStaticMarkup(await ProgrammePage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }));
  expect(html).toContain("145.000 SEK / năm");
  expect(html).toContain("Nguồn ghi: “SEK 145 000 per year”");
  expect(html).toContain('href="#fact-f1"');
  expect(html).toContain('id="fact-f1"');
});
it("returns not found for malformed ids and unpublished programmes, and fails closed on errors", async () => {
  await expect(ProgrammePage({ params: Promise.resolve({ id: "x" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  results.push({ data: null, error: null }, { data: [], error: null }, { data: [], error: null });
  await expect(ProgrammePage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  results.push({ data: null, error: { message: "down" } }, { data: [], error: null }, { data: [], error: null });
  await expect(ProgrammePage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })).rejects.toThrow("Không tải được");
});
it("redirects a page past the last result to page 1, keeping filters", async () => {
  results.push({ data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" } });
  await expect(ProgrammesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ country: "sweden", page: "9" }) }))
    .rejects.toThrow("REDIRECT:/programmes?country=sweden");
});
