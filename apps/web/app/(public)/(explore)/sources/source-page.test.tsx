import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { getSource } = vi.hoisted(() => ({ getSource: vi.fn() }));
// Detail pages ask whether the visitor bookmarked the item; render as a guest here.
vi.mock("@/lib/workspace/saved", () => ({ savedState: async () => ({ signedIn: false, saved: false }) }));
vi.mock("@/components/save-button", () => ({ SaveButton: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/registry/queries", () => ({ getSource }));
import SourcePage from "./[id]/page";
const base = {
  id: "s1", name: "Synthetic source", canonicalUrl: "https://example.com/", sourceTier: null, sourceType: null, topics: [], language: null,
  authorityNotes: null, status: "needs_verification", crawlEnabled: false, crawlPolicy: "not_reviewed", crawlFrequency: null,
  lastCrawledAt: null, lastVerifiedAt: null, notes: null, country: null, documents: [], _count: { documents: 0 },
};
const render = async () => renderToStaticMarkup(await SourcePage({ params: Promise.resolve({ id: "s1" }), searchParams: Promise.resolve({}) }));

it("shows full registry metadata with unknowns stated, and the original link", async () => {
  getSource.mockResolvedValue(base);
  const html = await render();
  expect(html).toContain('href="https://example.com/"');
  for (const text of ["Unclassified", "Not available", "Needs verification", "Disabled", "Not assigned", "Not reviewed", "No documents have been imported"]) expect(html).toContain(text);
});
it("never renders an unsafe URL as a link and 404s unknown sources", async () => {
  getSource.mockResolvedValue({ ...base, canonicalUrl: "javascript:alert(1)" });
  const html = await render();
  expect(html).not.toContain("javascript:");
  expect(html).toContain("Source URL needs verification");
  getSource.mockResolvedValue(null);
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
