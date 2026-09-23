import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Source } from "@nordic/db";
import { SourceList } from "./source-list";

const source: Source = {
  id: "test", name: "Test fixture", canonicalUrl: "https://example.com/", countryId: null,
  sourceTier: null, sourceType: null, topics: [], language: null, authorityNotes: null,
  status: "needs_verification", crawlEnabled: false, crawlPolicy: "not_reviewed",
  crawlFrequency: null, lastCrawledAt: null, lastVerifiedAt: null, notes: null,
  createdAt: new Date(), updatedAt: new Date(),
};
it("renders compact rows that link to the source page, with unknowns stated", () => {
  const html = renderToStaticMarkup(<SourceList sources={[source]} />);
  expect(html).toContain('href="/sources/test"');
  for (const text of ["Test fixture", "example.com", "Unclassified", "Needs verification", "Not assigned"]) expect(html).toContain(text);
});
it("renders empty states and rejects unsafe source links", () => {
  expect(renderToStaticMarkup(<SourceList sources={[]} />)).toContain("No sources found");
  const html = renderToStaticMarkup(<SourceList sources={[{ ...source, canonicalUrl: "javascript:alert(1)" }]} />);
  expect(html).not.toContain("javascript:");
  expect(html).toContain("Source URL needs verification");
});
