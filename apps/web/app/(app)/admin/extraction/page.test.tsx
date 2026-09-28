import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { ctx } = vi.hoisted(() => ({ ctx: vi.fn() }));
vi.mock("@/lib/rbac/access", () => ({ accessContext: ctx, logAccessError: vi.fn() }));
vi.mock("./forms", () => ({ AccountForm: () => <form data-testid="account-form" /> }));
import Page from "./page";

const rows: Record<string, unknown> = {
  extraction_settings: null,
  extraction_requests: [{ id: "q1", document_id: "d1", status: "pending", note: null, created_at: "2026-09-28T08:00:00Z", documents: { title: "Synthetic page", canonical_url: "https://a.example.test/" } }],
  extraction_runs: [{ id: "r1", trigger: "manual", provider: "llm.example.test", model: "synthetic-model", prompt_version: "extract-v1", status: "partial",
    started_at: "2026-09-28T09:00:00Z", note: null, input_tokens: 1200, output_tokens: 300, counts: { proposed: 1, invalid: 1 },
    extraction_items: [{ id: "i1", outcome: "invalid", reason: "Excerpt not found verbatim in the document text", fact_id: null, candidate: { subject: "Permit", predicate: "fee", value: "100" } }] }],
};
const chain = (table: string) => { const q = { select: () => q, in: () => q, order: () => q, limit: () => q,
  maybeSingle: () => Promise.resolve({ data: rows[table], error: null }), then: (r: (v: unknown) => unknown) => r({ data: rows[table], error: null }) }; return q; };

it("refuses users who are neither editors nor admins", async () => {
  ctx.mockResolvedValue({ client: {}, permissions: ["documents.read"] });
  expect(renderToStaticMarkup(await Page())).toContain("Không có quyền");
});
it("warns when no AI account is set and explains why candidates were refused", async () => {
  ctx.mockResolvedValue({ client: { from: chain }, permissions: ["facts.review"] });
  const html = renderToStaticMarkup(await Page());
  for (const v of ["Chưa cấu hình tài khoản AI", "Synthetic page", "Có lỗi một phần", "synthetic-model", "not found verbatim", "1.200 token vào"]) expect(html).toContain(v);
  expect(html).not.toContain("account-form");
});
