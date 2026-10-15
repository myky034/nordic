import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isStructureV1, type DocumentStructure } from "@nordic/db/document-structure";
import { canOpenPreview, canReadStructures, diffStructures, filterStructure, previewState, sectionsOf, shortHash } from "./structure-view";

// Contract: the reader is checked against the crawler's real output, saved as
// JSON by the crawler (its own test keeps the files current). Importing crawler
// code here would break the web build, which does not install cheerio.
const structure = (name: string): DocumentStructure => JSON.parse(readFileSync(new URL(`../../../../crawler/test/fixtures/structures/${name}.json`, import.meta.url), "utf8"));
const sidebar = () => structure("programme-sidebar");

describe("shape check (shared contract)", () => {
  it("accepts the crawler's real output and rejects malformed or unknown formats", () => {
    for (const f of ["programme-sidebar", "programme-table", "programme-dl", "programme-rendered", "programme-sidebar-changed"]) expect(isStructureV1(structure(f))).toBe(true);
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
  describe("duplicate labels in one section (review 2026-10-15)", () => {
    const withPairs = (values: string[], section = ["Admissions"]): DocumentStructure => ({
      ...sidebar(), pairs: values.map((value, i) => ({ ref: `p${i + 1}`, domPath: `dl>dd:nth-of-type(${i + 1})`, label: "Application deadline", value, section, from: "dl" as const,
        labelPath: `dl>dt:nth-of-type(${i + 1})`, valuePath: `dl>dd:nth-of-type(${i + 1})` })),
    });
    it("keeps every value: same values in another order are not a difference", () => {
      expect(diffStructures(withPairs(["15 January 2027", "15 April 2027"]), withPairs(["15 April 2027", "15 January 2027"])).same).toBe(true);
    });
    it("reports a change to ONE of two same-label values, not an overwrite", () => {
      const d = diffStructures(withPairs(["15 January 2027", "15 April 2027"]), withPairs(["15 January 2027", "1 May 2027"]));
      expect(d.pairs).toEqual({ added: [], removed: [], changed: [{ label: "Application deadline", section: ["Admissions"], before: "15 April 2027", after: "1 May 2027" }] });
    });
    it("reports an added and a removed repeat of the label", () => {
      expect(diffStructures(withPairs(["15 January 2027"]), withPairs(["15 January 2027", "15 April 2027"])).pairs.added.map((p) => p.value)).toEqual(["15 April 2027"]);
      const removed = diffStructures(withPairs(["15 January 2027", "15 April 2027", "15 April 2027"]), withPairs(["15 January 2027", "15 April 2027"]));
      expect(removed.pairs.removed.map((p) => p.value)).toEqual(["15 April 2027"]);
      expect(removed.pairs.changed).toEqual([]);
    });
    it("keeps the same label in different sections apart", () => {
      const d = diffStructures(withPairs(["15 January 2027"], ["Intake A"]), withPairs(["15 January 2027"], ["Intake B"]));
      expect(d.pairs.removed.map((p) => p.section)).toEqual([["Intake A"]]);
      expect(d.pairs.added.map((p) => p.section)).toEqual([["Intake B"]]);
    });
  });
  it("reports added, removed and changed pairs, headings, links and blocks", () => {
    const before = sidebar();
    const d = diffStructures(before, structure("programme-sidebar-changed"));
    expect(d.same).toBe(false);
    expect(d.pairs.changed).toEqual([expect.objectContaining({ label: "Tuition fee", before: expect.stringContaining("90000"), after: expect.stringContaining("95000") })]);
    expect(d.headings).toEqual({ added: ["h3 Year One"], removed: ["h3 Year 1"] });
    expect(d.links.added.map((l) => l.href)).toEqual(["https://uni.example.test/course/ex3"]);
    expect(d.links.removed.map((l) => l.href)).toEqual(["https://uni.example.test/course/ex2"]);
    expect(d.blocks.added).toContain("Example Practice 7.5 credits");
  });
});
