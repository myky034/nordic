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
it("renders source attribution and unknown metadata truthfully", () => {
  const html = renderToStaticMarkup(<SourceList sources={[source]} />);
  expect(html).toContain('href="https://example.com/"');
  for (const text of ["Unclassified", "Not available", "Needs verification", "Disabled", "Not assigned"]) expect(html).toContain(text);
});
it("renders empty states and rejects unsafe source links", () => {
  expect(renderToStaticMarkup(<SourceList sources={[]} />)).toContain("No sources found");
  const html = renderToStaticMarkup(<SourceList sources={[{ ...source, canonicalUrl: "javascript:alert(1)" }]} />);
  expect(html).not.toContain("javascript:");
  expect(html).toContain("Source URL needs verification");
});
