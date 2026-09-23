import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { calls, results } = vi.hoisted(() => ({ calls: [] as unknown[][], results: [] as { data: unknown; error: unknown }[] }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("next/form", () => ({ default: (props: { children: React.ReactNode }) => <form>{props.children}</form> }));
vi.mock("@/lib/rbac/access", () => ({ logAccessError: vi.fn() }));
function builder(result: { data: unknown; error: unknown }): Record<string, unknown> {
  const self: Record<string, unknown> = { then: (resolve: (v: unknown) => void) => resolve(result) };
  for (const m of ["select", "eq", "in", "ilike", "order", "limit", "range", "maybeSingle"]) self[m] = (...args: unknown[]) => { calls.push([m, ...args]); return self; };
  return self;
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => builder(results.shift()!) }) }));
import ImmigrationPage from "./page";
import ImmigrationRulePage from "./[id]/page";
const id = "11111111-1111-4111-8111-111111111111";
const source = { name: "Synthetic authority", source_tier: "T1", status: "verified", last_verified_at: "2026-09-20T00:00:00Z" };
const rule = {
  id, rule_type: "work_permit", title: "Synthetic work permit", official_url: "https://authority.example.test/p", evidence_excerpt: "Synthetic excerpt.",
  reviewed_at: "2026-09-21T00:00:00Z", countries: { slug: "sweden", name: "Sweden" },
  documents: { canonical_url: "https://authority.example.test/p", retrieved_at: "2026-09-19T00:00:00Z", title: null, sources: source },
};
const fact = (status: string, tier: string) => ({
  id: `f-${status}-${tier}`, document_id: "d", immigration_rule_id: id, topic: "immigration", subject: "s", predicate: "financial requirement", value: "synthetic",
  unit: null, status, valid_from: null, valid_until: null, reviewed_at: null,
  evidence: { source_url: "https://x.example.test/", excerpt: "e", retrieved_at: "2026-09-19T00:00:00Z" },
  documents: { title: null, sources: { name: `Source ${tier}`, source_tier: tier } },
});

it("always shows the disclaimer and requires reviewed rules from verified T1 sources", async () => {
  calls.length = 0; results.push({ data: [], error: null }, { data: [], error: null });
  const html = renderToStaticMarkup(await ImmigrationPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ country: "sweden", type: "golden_visa" }) }));
  expect(html).toContain("không phải tư vấn di trú");
  for (const c of [["eq", "status", "reviewed"], ["eq", "documents.sources.status", "verified"], ["eq", "documents.sources.source_tier", "T1"], ["eq", "countries.slug", "sweden"]]) expect(calls).toContainEqual(c);
  expect(calls.some((c) => c[1] === "rule_type")).toBe(false);
  expect(html).toContain("No reviewed rules backed by a verified official source");
});
it("shows verification dates, a conflict banner and labels non-T1 requirements", async () => {
  results.push({ data: rule, error: null }, { data: [fact("conflicted", "T1"), fact("reviewed", "T3")], error: null });
  const html = renderToStaticMarkup(await ImmigrationRulePage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }));
  for (const text of ["không phải tư vấn di trú", "Synthetic work permit", "Source last verified: 2026-09-20", "mâu thuẫn giữa các nguồn", "Không phải nguồn chính thức (T1)"]) expect(html).toContain(text);
  expect(html.match(/Không phải nguồn chính thức/g)).toHaveLength(1);
});
it("returns not found for unpublished rules and fails closed on errors", async () => {
  await expect(ImmigrationRulePage({ params: Promise.resolve({ id: "x" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  results.push({ data: null, error: null }, { data: [], error: null });
  await expect(ImmigrationRulePage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  results.push({ data: null, error: { message: "down" } }, { data: [], error: null });
  await expect(ImmigrationRulePage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })).rejects.toThrow("Không tải được");
});
