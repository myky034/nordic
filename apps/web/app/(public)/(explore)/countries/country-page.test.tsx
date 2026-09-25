import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { getCountry, result } = vi.hoisted(() => ({ getCountry: vi.fn(), result: { data: [] as unknown[], error: null as unknown } }));
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
  for (const method of ["select", "eq", "in", "order", "limit"]) self[method] = () => self;
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
  expect(html).toContain("No evidence-backed facts for this country yet");
  expect(html).not.toContain("Country profile data is not available yet");
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
  expect(html).not.toContain("No evidence-backed facts for this country yet");
});
it("fails closed on a database error instead of showing a silently empty profile", async () => {
  getCountry.mockResolvedValue({ id: "c1", slug: "sweden", name: "Sweden", status: "active", sources: [] });
  result.data = []; result.error = { message: "connection refused" };
  await expect(CountryPage({ params: Promise.resolve({ slug: "sweden" }), searchParams: Promise.resolve({}) })).rejects.toThrow();
});
