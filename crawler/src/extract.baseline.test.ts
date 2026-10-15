import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { textHash } from "@nordic/db/document-hash";
import { extractPage } from "./extract";

// PR 0 baseline (configurable extraction plan, 2026-10-15): what the current
// extractor (hash method sha256-text-v1) produces for the synthetic layouts in
// test/fixtures. Structured parsing (PR 1) must leave this text and its hash
// unchanged, or version the hash method explicitly. The snapshots also record
// today's known limits, asserted explicitly below.
const fixture = (name: string) => readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), "utf8");
const pages = ["programme-sidebar.html", "programme-table.html", "programme-dl.html"] as const;

for (const name of pages) {
  it(`pins the readable text and hash of ${name}`, () => {
    const page = extractPage(fixture(name));
    expect({ title: page.title, text: page.text, hash: textHash(page.text) }).toMatchSnapshot();
  });
}
it("records the known limits of flattened text that PR 1 addresses", () => {
  const sidebar = extractPage(fixture("programme-sidebar.html")).text;
  // An inline label and its value run together: no boundary survives.
  expect(sidebar).toContain("Tuition feeFirst instalment: 45000 SEK.");
  // Data that only exists in an embedded JSON state is dropped with the script.
  expect(sidebar).not.toContain("90000\n");
  expect(sidebar).not.toContain("educationData");
  const table = extractPage(fixture("programme-table.html")).text;
  // Table rows become lines, header and cell glued: "Duration2 years, full-time".
  expect(table).toContain("Duration2 years, full-time");
  // Links are lost: the PDF link target is not in the text.
  expect(extractPage(fixture("programme-dl.html")).text).not.toContain("fees.pdf");
});
