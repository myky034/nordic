import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { ctx } = vi.hoisted(() => ({ ctx: vi.fn() }));
vi.mock("@/lib/rbac/access", () => ({ accessContext: ctx, logAccessError: vi.fn() }));
import Page from "./page";
import { ActivitySection, CoverageSection, CrawlerSection, ExtractionSection } from "./sections";

const page = (q: Record<string, string> = {}) => Page({ params: Promise.resolve({}), searchParams: Promise.resolve(q) });
const now = new Date("2026-10-01T12:00:00Z");

// PostgREST-like chain: every query on `table` resolves to rows[table]; the
// exact count defaults to the number of rows unless counts[table] says more.
type Result = { data: unknown; count: number | null; error: unknown };
const client = (rows: Record<string, unknown[] | "error">, counts: Record<string, number> = {}) => ({
  from: (table: string) => {
    const v = rows[table] ?? [];
    const result: Result = v === "error" ? { data: null, count: null, error: { message: "x" } } : { data: v, count: counts[table] ?? v.length, error: null };
    const q = { select: () => q, eq: () => q, in: () => q, gte: () => q, order: () => q, limit: () => q, range: () => q,
      maybeSingle: () => Promise.resolve({ ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : null }),
      then: (r: (v: Result) => unknown) => r(result) };
    return q;
  },
});
const html = async (node: Promise<React.ReactElement>) => renderToStaticMarkup(await node);

it("is for administrators only", async () => {
  ctx.mockResolvedValue({ client: client({}), permissions: ["facts.review", "crawler.manage"] });
  expect(renderToStaticMarkup(await page())).toContain("Không có quyền xem bảng điều khiển quản trị");
});

it("says which permission a section needs instead of showing zeros", async () => {
  const props = { client: client({}) as never, permissions: ["roles.manage"], now };
  expect(await html(CrawlerSection(props))).toContain("Cần quyền “Quản lý crawler (crawler.manage)”");
  expect(await html(ExtractionSection(props))).toContain("Cần quyền");
  expect(await html(CoverageSection(props))).toContain("Cần quyền");
  expect(await html(ActivitySection({ ...props, days: 7 }))).toContain("Cần quyền “Duyệt đề xuất (facts.review)”");
});

it("shows crawler state, URLs needing a look, and a stale schedule", async () => {
  const c = client({ crawler_runs: [{ status: "partial", started_at: "2026-09-20T03:00:00Z" }],
    crawl_url_states: [{ last_outcome: "created" }, { last_outcome: "error" }], crawl_targets: [] }, { crawl_targets: 4 });
  const out = await html(CrawlerSection({ client: c as never, permissions: ["crawler.manage"], now }));
  for (const v of ["Có lỗi một phần", "11 ngày trước", "Lỗi: 1", "chưa chạy hơn 8 ngày", ">4<"]) expect(out).toContain(v);
});

it("warns when the AI account is missing and sums token use", async () => {
  const c = client({ extraction_runs: [{ status: "succeeded", started_at: "2026-09-30T00:00:00Z", input_tokens: 1200, output_tokens: 300 }],
    extraction_requests: [], extraction_settings: [] }, { extraction_requests: 2 });
  const out = await html(ExtractionSection({ client: c as never, permissions: ["facts.review"], now }));
  for (const v of ["Chưa chọn tài khoản AI", "1.200 / 300", "Thành công", ">2<"]) expect(out).toContain(v);
});

it("reports a failed load as such, never as zero", async () => {
  const c = client({ crawler_runs: "error" });
  expect(await html(CrawlerSection({ client: c as never, permissions: ["crawler.manage"], now }))).toContain("Không tải được phần này");
});

it("builds the coverage table and flags truncated counts", async () => {
  const rows = { countries: [{ id: "se", slug: "sweden", name: "Sweden" }],
    sources: [{ country_id: "se", status: "verified" }, { country_id: "se", status: "needs_verification" }],
    facts: [{ country_id: "se", status: "proposed" }, { country_id: null, status: "reviewed" }],
    programmes: [{ status: "reviewed", universities: { country_id: "se" } }] };
  const out = await html(CoverageSection({ client: client(rows) as never, permissions: ["facts.review"] }));
  for (const v of ["Thụy Điển", "1 / 2", "Không gắn quốc gia", "Tổng", "/countries/sweden"]) expect(out).toContain(v);
  expect(out).not.toContain("Chưa đếm đủ");
  const truncated = await html(CoverageSection({ client: client(rows, { facts: 9000 }) as never, permissions: ["facts.review"] }));
  expect(truncated).toContain("Chưa đếm đủ");
});

it("tallies decisions in the window and the oldest waiting proposal", async () => {
  const c = client({ fact_reviews: [{ decision: "reviewed", created_at: "2026-09-30T08:00:00Z" }, { decision: "rejected", created_at: "2026-09-30T09:00:00Z" }, { decision: "revalidated", created_at: "2026-10-01T09:00:00Z" }],
    facts: [{ created_at: "2026-09-21T00:00:00Z" }] }, { facts: 5 });
  const out = await html(ActivitySection({ client: c as never, permissions: ["facts.review"], now, days: 30 }));
  for (const v of ["Vẫn khớp nguồn mới", ">3<", ">5<", "10 ngày", 'role="img"', "Quyết định duyệt theo ngày, 30 ngày qua. 3 quyết định", "30/9: Duyệt 1 · Từ chối 1"]) expect(out).toContain(v);
});
