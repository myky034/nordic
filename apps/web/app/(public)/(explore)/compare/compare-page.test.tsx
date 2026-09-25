import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { tables, calls } = vi.hoisted(() => ({ tables: {} as Record<string, { data: unknown; count?: number }>, calls: [] as unknown[][] }));
vi.mock("next/form", () => ({ default: (props: { children: React.ReactNode }) => <form>{props.children}</form> }));
vi.mock("@/lib/rbac/access", () => ({ logAccessError: vi.fn() }));
function builder(table: string): Record<string, unknown> {
  const self: Record<string, unknown> = { then: (resolve: (v: unknown) => void) => resolve({ data: tables[table]?.data ?? [], count: tables[table]?.count ?? 0, error: null }) };
  for (const m of ["select", "eq", "in", "order", "limit"]) self[m] = (...args: unknown[]) => { calls.push([table, m, ...args]); return self; };
  return self;
}
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from: (t: string) => builder(t) }) }));
import ComparePage from "./page";
const render = async (query: Record<string, string | string[]>) => renderToStaticMarkup(await ComparePage({ params: Promise.resolve({}), searchParams: Promise.resolve(query) }));
const fact = (id: string, country: string, value: string, period: string, status = "reviewed") => ({
  id, document_id: "d", metric_id: "m1", country_id: country, value, unit: "EUR", reference_period: period, status, created_at: "2026-09-20",
  evidence: { retrieved_at: "2026-09-19T00:00:00Z" }, documents: { sources: { name: `Source ${id}`, source_tier: "T1" } },
});

it("asks for at least two countries before querying values", async () => {
  calls.length = 0;
  const html = await render({ c: "sweden" });
  expect(html).toContain("Chọn ít nhất 2 quốc gia");
  expect(calls.some((c) => c[0] === "facts")).toBe(false);
});
it("shows every value per cell with its own source and period, and never a score", async () => {
  tables.countries = { data: [{ id: "se", slug: "sweden", name: "Sweden" }, { id: "dk", slug: "denmark", name: "Denmark" }] };
  tables.comparison_metrics = { data: [{ id: "m1", label: "Synthetic monthly cost", description: "Synthetic definition", unit_hint: "EUR/month", category: "living_cost" }] };
  tables.facts = { data: [fact("a", "se", "100", "2023"), fact("b", "se", "120", "2025-Q1", "conflicted")] };
  calls.length = 0;
  const html = await render({ c: ["sweden", "denmark"] });
  for (const t of ["Synthetic monthly cost", "100 EUR", "120 EUR", "2025-Q1", "Source a", "Mâu thuẫn", "Chưa có dữ liệu", "không phải tổng số"]) expect(html).toContain(t);
  expect(html.indexOf("120 EUR")).toBeLessThan(html.indexOf("100 EUR"));
  // The page states that there is no score; it must never render one.
  expect(html).toContain("no overall score or ranking");
  expect(html.toLowerCase()).not.toMatch(/\baverage\b|score:|ranked #|\bbest\b|\bwinner\b/);
  expect(calls).toContainEqual(["facts", "in", "status", ["reviewed", "conflicted"]]);
});
