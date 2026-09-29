import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { ctx } = vi.hoisted(() => ({ ctx: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAuth: vi.fn(), getCurrentUser: async () => ({ email: "reviewer@example.test" }) }));
vi.mock("@/lib/rbac/access", () => ({ accessContext: ctx, logAccessError: vi.fn() }));
import Page from "./page";

// Minimal PostgREST-like chain resolving to a count per table.
const client = (counts: Record<string, number | "error">) => ({
  from: (table: string) => {
    const result = counts[table] === "error" ? { count: null, error: { message: "x" } } : { count: counts[table], error: null };
    const q = { select: () => q, eq: () => q, not: () => q, in: () => q, then: (r: (v: unknown) => unknown) => r(result) };
    return q;
  },
});

it("shows a plain member only their own and explore tiles, with no counters", async () => {
  ctx.mockResolvedValue({ client: client({}), permissions: [] });
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain("My workspace");
  expect(html).toContain("Khám phá");
  expect(html).not.toContain("Cần xử lý");
  expect(html).not.toContain("/admin/");
});
it("shows reviewer counts, and an unloadable count as unknown rather than zero", async () => {
  ctx.mockResolvedValue({ client: client({ facts: 7, extraction_requests: "error" }), permissions: ["facts.review"] });
  const html = renderToStaticMarkup(await Page());
  for (const v of ["Cần xử lý", "Đề xuất chờ duyệt", ">7<", "Nguồn đã đổi", "Không tải được", "reviewer@example.test"]) expect(html).toContain(v);
  expect(html).not.toContain("Nguồn cần xác minh");
});
