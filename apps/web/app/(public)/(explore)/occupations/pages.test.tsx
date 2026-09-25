import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { calls, results } = vi.hoisted(() => ({ calls: [] as unknown[][], results: [] as { data: unknown; error: unknown; count?: number }[] }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Error(`REDIRECT:${u}`); } }));
vi.mock("next/form", () => ({ default: (props: { children: React.ReactNode }) => <form>{props.children}</form> }));
vi.mock("@/lib/rbac/access", () => ({ logAccessError: vi.fn() }));
function builder(result: { data: unknown; error: unknown; count?: number }): Record<string, unknown> {
  const self: Record<string, unknown> = { then: (resolve: (v: unknown) => void) => resolve(result) };
  for (const m of ["select", "eq", "in", "ilike", "order", "limit", "range", "maybeSingle"]) self[m] = (...args: unknown[]) => { calls.push([m, ...args]); return self; };
  return self;
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => builder(results.shift() ?? { data: null, error: null, count: 0 }) }) }));
import OccupationsPage from "./page";
import OccupationPage from "./[id]/page";
const id = "11111111-1111-4111-8111-111111111111";
const occupation = {
  id, name: "Synthetic analyst", classification_system: "ISCO-08", classification_code: "0000", countries: null,
  evidence_excerpt: "Synthetic excerpt.", reviewed_at: "2026-09-24T00:00:00Z",
  documents: { canonical_url: "https://stats.example.test/t", retrieved_at: "2026-09-20T00:00:00Z", title: null, sources: { name: "Synthetic stats", source_tier: "T1" } },
};
const figure = (tier: string, status = "reviewed") => ({
  id: `f-${tier}-${status}`, document_id: "d", occupation_id: id, reference_period: "2024", topic: "labour_market", subject: "Synthetic analyst", predicate: "synthetic metric",
  value: "synthetic", unit: "EUR", status, valid_from: null, valid_until: null, reviewed_at: null,
  evidence: { source_url: "https://x.example.test/", excerpt: "e", retrieved_at: "2026-09-19T00:00:00Z" },
  documents: { title: null, sources: { name: `Source ${tier}`, source_tier: tier } },
});

it("lists only reviewed occupations and states that figures are not forecasts", async () => {
  calls.length = 0; results.push({ data: [], error: null, count: 0 });
  const html = renderToStaticMarkup(await OccupationsPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ q: "anal" }) }));
  expect(calls).toContainEqual(["eq", "status", "reviewed"]);
  expect(calls).toContainEqual(["ilike", "name", "%anal%"]);
  expect(html).toContain("not a forecast");
});
it("requires a verified source, shows reference periods, labels non-official figures and warns on conflicts", async () => {
  calls.length = 0;
  // Queue order = order of client.from() calls: figures query, occupation, per-country counts.
  results.push({ data: [figure("T1", "conflicted"), figure("T4")], error: null, count: 2 }, { data: occupation, error: null },
    ...Array.from({ length: 5 }, () => ({ data: null, error: null, count: 1 })));
  const html = renderToStaticMarkup(await OccupationPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ country: "sweden" }) }));
  expect(calls).toContainEqual(["eq", "documents.sources.status", "verified"]);
  expect(calls).toContainEqual(["eq", "countries.slug", "sweden"]);
  for (const text of ["Synthetic analyst", "ISCO-08 0000", "International definition", "Kỳ số liệu: 2024", "Sources disagree", "Không phải số liệu thống kê chính thức"]) expect(html).toContain(text);
  expect(html.match(/Không phải số liệu thống kê chính thức/g)).toHaveLength(1);
});
it("404s unknown or unpublished occupations and redirects a page past the end", async () => {
  await expect(OccupationPage({ params: Promise.resolve({ id: "x" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  results.push({ data: [], error: null, count: 0 }, { data: null, error: null });
  await expect(OccupationPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  results.push({ data: null, error: { code: "PGRST103" } });
  await expect(OccupationsPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ page: "9" }) })).rejects.toThrow("REDIRECT:/occupations");
});
