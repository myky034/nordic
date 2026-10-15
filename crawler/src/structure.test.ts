import { readFileSync } from "node:fs";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { extractStructure, normaliseHref, STRUCTURE_LIMITS } from "./structure";

// PR 1 (docs/architecture/pr1-structured-content-plan.md, acceptance §7).
const fixture = (name: string) => readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), "utf8");
const at = "https://uni.example.test/programme?x=1";

describe("label/value pairs, tables, definition lists and links", () => {
  it("reads a sidebar of label/value elements without gluing label and value", () => {
    const s = extractStructure(fixture("programme-sidebar.html"), null, at);
    const pair = (label: string) => s.pairs.find((p) => p.label === label);
    expect(pair("Tuition fee")).toMatchObject({ from: "label_value", value: "First instalment: 45000 SEK. The complete course: 90000 SEK." });
    for (const label of ["Eligibility", "Selection", "Credits"]) expect(pair(label)?.from).toBe("label_value");
    // Siblings in a list or a control are not label/value pairs.
    expect(s.pairs.map((p) => p.label)).not.toContain("Autumn 2027");
    expect(s.pairs.map((p) => p.label)).not.toContain("Example Methods 7.5 credits");
    // Sidebar text keeps its words apart ("Beginning/End week commencing …").
    expect(s.blocks.map((b) => b.text)).toContain("Beginning/End week commencing 30/08/2027 - 03/06/2029");
  });
  it("reads key-fact tables as th/td pairs and data tables with headers and cells", () => {
    const s = extractStructure(fixture("programme-table.html"), null, at);
    expect(s.pairs.find((p) => p.label === "Duration")).toMatchObject({ from: "th_row", value: "2 years, full-time" });
    const curriculum = s.tables.find((t) => t.headers.length)!;
    expect(curriculum.headers).toEqual(["Semester", "Course", "ECTS"]);
    expect(curriculum.rows).toEqual([{ cells: ["1", "Sample Foundations", "10"] }, { cells: ["4", "Thesis", "30"] }]);
    expect(curriculum.section).toEqual(["MSc Sample Engineering", "Curriculum"]);
  });
  it("reads definition lists, nested list depth and absolute PDF links", () => {
    const s = extractStructure(fixture("programme-dl.html"), null, at);
    expect(s.pairs.filter((p) => p.from === "dl").map((p) => [p.label, p.value])).toEqual([
      ["Study pace", "Full-time, on campus"], ["Duration", "18 months"], ["Fee", "NOK 0 for EU/EEA students; other students see the fee page"]]);
    expect(s.blocks.filter((b) => b.kind === "li").map((b) => [b.text, b.depth])).toEqual([
      ["Bachelor's degree (180 ECTS)", 0], ["including 30 ECTS mathematics", 1], ["IELTS Academic 6.5 overall", 0]]);
    expect(s.links).toEqual([expect.objectContaining({ href: "https://demo.example.test/fees.pdf", fileType: "pdf", sameOrigin: false, text: "fees (PDF)" })]);
  });
  it("places each element under the headings that precede it, an aside only under the page title", () => {
    const s = extractStructure(fixture("programme-sidebar.html"), null, at);
    expect(s.blocks.find((b) => b.text === "Example Methods 7.5 credits")?.section).toEqual(["Master's Programme in Example Studies", "Programme overview", "Year 1"]);
    expect(s.pairs.find((p) => p.label === "Tuition fee")?.section).toEqual(["Master's Programme in Example Studies"]);
  });
});

describe("traceability (review item 1)", () => {
  it("gives every element a unique ref and a domPath that finds that element again in the snapshot", () => {
    const html = fixture("programme-sidebar.html");
    const s = extractStructure(html, null, at);
    const refs = [...s.headings, ...s.blocks, ...s.pairs, ...s.tables, ...s.links].map((e) => e.ref);
    expect(new Set(refs).size).toBe(refs.length);
    const $ = load(html);
    const pair = s.pairs.find((p) => p.label === "Tuition fee")!;
    expect($(pair.labelPath).text().trim()).toBe("Tuition fee");
    expect($(pair.valuePath).text().trim()).toBe("First instalment: 45000 SEK. The complete course: 90000 SEK.");
    for (const b of s.blocks.filter((x) => x.kind !== "text")) expect($(b.domPath)).toHaveLength(1);
  });
});

describe("structured data and script state (review item 2)", () => {
  it("keeps valid JSON-LD under the json-ld adapter, skips malformed JSON-LD and never reads script state", () => {
    const s = extractStructure(fixture("programme-rendered.html"), null, "https://uni.example.test/en/rendered");
    expect(s.structuredData).toEqual([{ adapter: "json-ld", adapterVersion: 1, items: [expect.objectContaining({ "@type": "EducationalOccupationalProgram", timeToComplete: "P2Y" })] }]);
    expect(JSON.stringify(s)).not.toContain("12345");
    expect(JSON.stringify(s)).not.toContain("__STATE__");
    expect(s.lang).toBe("sv");
    expect(s.canonicalUrl).toBe("https://uni.example.test/en/rendered");
  });
  it("normalises links: absolute, no fragment, no tracking or session parameters, http(s) only", () => {
    const s = extractStructure(fixture("programme-rendered.html"), null, "https://uni.example.test/en/rendered");
    expect(s.links.map((l) => l.href)).toEqual(["https://uni.example.test/en/pace", "https://other.example.test/brochure.pdf"]);
    expect(normaliseHref("/a;jsessionid=1?b=2&utm_source=x", "https://u.example.test/")).toBe("https://u.example.test/a?b=2");
    expect(normaliseHref("javascript:alert(1)", "https://u.example.test/")).toBeNull();
  });
});

describe("determinism (implementation requirement 1)", () => {
  // Unstable attributes, attribute order, whitespace, nonces and tracking
  // parameters must not change the structure (and so not its hash).
  const noisy = (html: string) => html
    .replace('id="content-8f3a" class="layout layout--wide" data-render-id="a81"', 'data-render-id="b77" class="layout" id="content-0c1d" nonce="r4nd0m"')
    .replace('style="color:red"', 'style="color:blue" data-v-1f2e')
    .replace("<span class=\"k\">Start</span>", "<span   class=\"k  extra\">\n   Start\n</span>")
    .replace("utm_campaign=x", "utm_campaign=y")
    .replace("jsessionid=XYZ", "jsessionid=ABC");
  it("produces identical JSON when only attributes, whitespace or volatile URL parameters change", () => {
    const html = fixture("programme-rendered.html");
    expect(noisy(html)).not.toBe(html);
    const a = extractStructure(html, null, "https://uni.example.test/en/rendered");
    const b = extractStructure(noisy(html), null, "https://uni.example.test/en/rendered");
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
  it("produces identical JSON on repeated runs and differs when visible content changes", () => {
    const html = fixture("programme-sidebar.html");
    expect(JSON.stringify(extractStructure(html, null, at))).toBe(JSON.stringify(extractStructure(html, null, at)));
    expect(JSON.stringify(extractStructure(html.replace("90000 SEK", "95000 SEK"), null, at))).not.toBe(JSON.stringify(extractStructure(html, null, at)));
    // A changed link target changes the structure even though the flat text does not.
    expect(JSON.stringify(extractStructure(html.replace("/course/ex1", "/course/ex9"), null, at))).not.toBe(JSON.stringify(extractStructure(html, null, at)));
  });
});

describe("limits", () => {
  it("cuts oversized pages, counts what was dropped and stays under the byte cap", () => {
    const many = `<main>${Array.from({ length: 1500 }, (_, i) => `<p>Paragraph ${i} ${"x".repeat(900)}</p><a href="/l${i}">link</a>`).join("")}</main>`;
    const s = extractStructure(many, null, at);
    expect(s.limits.truncated).toBe(true);
    expect(s.blocks.length).toBeLessThanOrEqual(STRUCTURE_LIMITS.blocks);
    expect((s.limits.dropped.blocks ?? 0) + s.blocks.length).toBeGreaterThanOrEqual(1500);
    expect(Buffer.byteLength(JSON.stringify(s))).toBeLessThanOrEqual(STRUCTURE_LIMITS.bytes);
  });
  it("uses the same region as the readable text and records which", () => {
    expect(extractStructure(fixture("programme-table.html"), null, at).root).toEqual({ kind: "article", selector: null });
    expect(extractStructure(fixture("programme-sidebar.html"), "aside", at).root).toEqual({ kind: "selector", selector: "aside" });
  });
});
