import { expect, it } from "vitest";
import { parseDocumentInput, validateSource } from "./domain";
import { fixture } from "./fixtures.test-helper";

it("canonicalizes conservatively and keeps missing facts null", () => {
  const input = parseDocumentInput({ ...fixture, title: undefined, excerpt: undefined });
  expect(input.canonicalUrl).toBe("https://example.com/research");
  expect(input.title).toBeNull(); expect(input.excerpt).toBeNull(); expect(input.publishedAt).toBeNull();
});
it.each([
  { sourceId: "bad" }, { contentHash: "not-sha256" }, { url: "javascript:alert(1)" },
  { url: "https://user:secret@example.com/" }, { documentType: "executable" },
  { title: "a".repeat(301) }, { excerpt: "a".repeat(501) }, { ingestionMethod: "public" },
  { verified: true }, { content: "Full article" }, { retrievedAt: "2026-02-30T00:00:00Z" },
  { retrievedAt: "2099-01-01T00:00:00Z" }, { publishedAt: "2026-01-03T00:00:00Z" },
])("rejects invalid/unapproved fields: %j", (fields) => {
  expect(() => parseDocumentInput({ ...fixture, ...fields })).toThrow();
});
it("requires registered exact-origin source and does not enable crawling through manual import", () => {
  const input = parseDocumentInput(fixture);
  const source = { canonicalUrl: "https://example.com/", crawlPolicy: "not_reviewed", crawlEnabled: false, status: "needs_verification" };
  expect(() => validateSource(input, null)).toThrow("source_not_registered");
  expect(() => validateSource(input, { ...source, canonicalUrl: "https://example.com.attacker.test/" })).toThrow("source_url_mismatch");
  expect(() => validateSource(input, { ...source, crawlPolicy: "blocked" })).toThrow("source_blocked");
  expect(() => validateSource(input, source)).not.toThrow();
  expect(() => validateSource({ ...input, ingestionMethod: "crawler" }, source)).toThrow("crawl_not_enabled");
});
