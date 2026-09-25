import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { ctx } = vi.hoisted(() => ({ ctx: vi.fn() }));
vi.mock("@/lib/rbac/access", () => ({ accessContext: ctx, logAccessError: vi.fn() }));
vi.mock("./forms", () => ({ TargetForm: () => null }));
import Page from "./page";

const rows: Record<string, unknown[]> = {
  sources: [{ id: "s1", name: "Synthetic agency", canonical_url: "https://agency.example.test/", crawl_enabled: false, crawl_policy: "approved", status: "verified" }],
  crawl_targets: [{ id: "t1", source_id: "s1", url: "https://agency.example.test/permits", kind: "page", path_prefix: null, max_urls: 20, content_selector: "main", active: true }],
  crawl_url_states: [{ source_id: "s1", url: "https://agency.example.test/permits", last_status: 200, last_outcome: "created", last_fetched_at: "2026-09-25T08:00:00Z", last_document_id: "d1" }],
  crawler_runs: [{ id: "r1", trigger: "schedule", status: "partial", started_at: "2026-09-25T08:00:00Z", finished_at: null, note: null, counts: { created: 1, error: 1 },
    crawler_run_items: [{ id: "i1", url: "https://agency.example.test/permits", http_status: 200, outcome: "created", error_category: null, flagged_facts: 2, document_id: "d1" }] }],
};
const chain = (table: string) => { const q = { select: () => q, order: () => q, limit: () => q, then: (r: (v: unknown) => unknown) => r({ data: rows[table], error: null }) }; return q; };

it("refuses users without crawler.manage", async () => {
  ctx.mockResolvedValue({ client: {}, permissions: ["facts.review"] });
  expect(renderToStaticMarkup(await Page())).toContain("crawler.manage");
});
it("explains why a registered source is not crawled and summarises runs", async () => {
  ctx.mockResolvedValue({ client: { from: chain }, permissions: ["crawler.manage"] });
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain("chưa bật crawl");
  expect(html).toContain("https://agency.example.test/permits");
  expect(html).toContain("Có lỗi một phần");
  expect(html).toContain("2 fact cần xem lại");
  expect(html).toContain("/documents/d1");
});
