import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { calls, results } = vi.hoisted(() => ({ calls: [] as unknown[][], results: [] as { data: unknown; error: unknown }[] }));
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
  expect(html).toContain("No reviewed programmes match");
});
it("shows existence evidence and an honest empty state for tuition/deadlines", async () => {
  results.push({ data: programme, error: null }, { data: [], error: null });
  const html = renderToStaticMarkup(await ProgrammePage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }));
  for (const text of ["Synthetic Programme", "Synthetic University", "Synthetic source", "T2", "2026-09-19", "Not stated", "No reviewed tuition, deadline"]) expect(html).toContain(text);
});
it("returns not found for malformed ids and unpublished programmes, and fails closed on errors", async () => {
  await expect(ProgrammePage({ params: Promise.resolve({ id: "x" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  results.push({ data: null, error: null }, { data: [], error: null });
  await expect(ProgrammePage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  results.push({ data: null, error: { message: "down" } }, { data: [], error: null });
  await expect(ProgrammePage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })).rejects.toThrow("Không tải được");
});
it("redirects a page past the last result to page 1, keeping filters", async () => {
  results.push({ data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" } });
  await expect(ProgrammesPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ country: "sweden", page: "9" }) }))
    .rejects.toThrow("REDIRECT:/programmes?country=sweden");
});
