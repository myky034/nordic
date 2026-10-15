import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isStructureV1, type DocumentStructure } from "@nordic/db/document-structure";
// Contract test: the reader is checked against the writer's real output.
import { extractStructure } from "../../../../crawler/src/structure";
import { canOpenPreview, canReadStructures, diffStructures, filterStructure, previewState, sectionsOf, shortHash } from "./structure-view";

const fixture = (name: string) => readFileSync(new URL(`../../../../crawler/test/fixtures/${name}`, import.meta.url), "utf8");
const sidebar = () => extractStructure(fixture("programme-sidebar.html"), null, "https://uni.example.test/p");

describe("shape check (shared contract)", () => {
  it("accepts the crawler's real output and rejects malformed or unknown formats", () => {
    for (const f of ["programme-sidebar.html", "programme-table.html", "programme-dl.html", "programme-rendered.html"]) {
      expect(isStructureV1(JSON.parse(JSON.stringify(extractStructure(fixture(f), null, "https://uni.example.test/p"))))).toBe(true);
    }
    const s = JSON.parse(JSON.stringify(sidebar()));
    expect(isStructureV1({ ...s, formatVersion: "html-structure-v2" })).toBe(false);
    expect(isStructureV1({ ...s, pairs: [{ label: "x" }] })).toBe(false);
    expect(isStructureV1({ ...s, links: "nope" })).toBe(false);
    expect(isStructureV1(null)).toBe(false);
  });
});

describe("access and states", () => {
  it("opens the page for crawler operators and structure readers; data reading follows the RLS permissions", () => {
    expect(canOpenPreview(["crawler.manage"])).toBe(true);
    expect(canOpenPreview(["documents.ingest"])).toBe(true);
    expect(canOpenPreview(["documents.read"])).toBe(false);
    expect(canReadStructures(["crawler.manage"])).toBe(false);
    expect(canReadStructures(["facts.review"])).toBe(true);
  });
  it("tells apart not crawled, no access, missing and available", () => {
    expect(previewState({ ingestionMethod: "manual", canRead: true, snapshotCount: 0 })).toBe("not_crawled");
    expect(previewState({ ingestionMethod: "crawler", canRead: false, snapshotCount: 0 })).toBe("no_access");
    expect(previewState({ ingestionMethod: "crawler", canRead: true, snapshotCount: 0 })).toBe("missing");
    expect(previewState({ ingestionMethod: "crawler", canRead: true, snapshotCount: 2 })).toBe("available");
    expect(shortHash("a".repeat(64))).toBe("aaaaaaaa…aaaaaa");
  });
});

describe("filtering", () => {
  it("filters by text (case-insensitive) and by section, keeping order", () => {
    const s = sidebar();
    expect(filterStructure(s, { q: "TUITION" }).pairs.map((p) => p.label)).toEqual(["Tuition fee"]);
    expect(filterStructure(s, { q: "credits" }).blocks.map((b) => b.text)).toEqual(["Example Methods 7.5 credits", "Example Theory 7.5 credits", "Eligibility A Bachelor degree with at least 180 ECTS credits. English 6.", "Credits 60 credits"]);
    const inYear1 = filterStructure(s, { section: "Master's Programme in Example Studies › Programme overview" });
    expect(inYear1.blocks.map((b) => b.text)).toContain("Example Methods 7.5 credits");
    expect(inYear1.pairs.map((p) => p.label)).toEqual(["Required supporting documentation"]);
    expect(inYear1.pairs.map((p) => p.label)).not.toContain("Tuition fee");
    expect(sectionsOf(s)).toContain("Master's Programme in Example Studies › Programme overview › Year 1");
  });
});

describe("comparison by content (review requirement 5)", () => {
  it("reports no difference when only refs and domPaths differ", () => {
    const a = sidebar();
    const b: DocumentStructure = JSON.parse(JSON.stringify(a));
    b.pairs = b.pairs.map((p, i) => ({ ...p, ref: `p${100 + i}`, domPath: `div>x:nth-of-type(${i + 9})` }));
    b.links = [...b.links].reverse().reverse().map((l) => ({ ...l, ref: `l${50}`, domPath: "y" }));
    expect(diffStructures(a, b).same).toBe(true);
  });
  it("reports added, removed and changed pairs, headings, links and blocks", () => {
    const before = sidebar();
    const html = fixture("programme-sidebar.html").replace("90000 SEK", "95000 SEK").replace("<h3>Year 1</h3>", "<h3>Year One</h3>")
      .replace('<a href="/course/ex2">Example Theory 7.5 credits</a>', '<a href="/course/ex3">Example Practice 7.5 credits</a>');
    const d = diffStructures(before, extractStructure(html, null, "https://uni.example.test/p"));
    expect(d.same).toBe(false);
    expect(d.pairs.changed).toEqual([expect.objectContaining({ label: "Tuition fee", before: expect.stringContaining("90000"), after: expect.stringContaining("95000") })]);
    expect(d.headings).toEqual({ added: ["h3 Year One"], removed: ["h3 Year 1"] });
    expect(d.links.added.map((l) => l.href)).toEqual(["https://uni.example.test/course/ex3"]);
    expect(d.links.removed.map((l) => l.href)).toEqual(["https://uni.example.test/course/ex2"]);
    expect(d.blocks.added).toContain("Example Practice 7.5 credits");
  });
});
