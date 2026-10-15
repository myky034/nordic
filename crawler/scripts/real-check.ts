// PR 1 real-world acceptance: runs extractStructure on the local snapshots of
// real official pages and checks the conditions in test/real/expectations.json.
// Not part of `npm test`: a page without a URL or without a snapshot FAILS
// (exit code 1) instead of being skipped, so a missing check can never be
// reported as a passed real-world validation.
//
//   npm run real-check -w @nordic/crawler            (table)
//   npm run real-check -w @nordic/crawler -- --md    (markdown for the results doc)
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extractStructure } from "../src/structure";

type Expect = { pairLabels?: string[]; pairValueMatches?: Record<string, string>; sections?: string[]; pdfLink?: boolean; notInStructure?: string[]; minPairs?: number };
type Page = { id: string; university: string; url: string | null; selector: string | null; expect: Expect; pending?: string };
const { pages } = JSON.parse(readFileSync(new URL("../test/real/expectations.json", import.meta.url), "utf8")) as { pages: Page[] };
const md = process.argv.includes("--md");
type Row = { id: string; university: string; check: string; ok: boolean; detail: string };
const rows: Row[] = [];
const meta: string[] = [];

for (const page of pages) {
  const add = (check: string, ok: boolean, detail = "") => rows.push({ id: page.id, university: page.university, check, ok, detail });
  if (!page.url) { add("url", false, page.pending ?? "no URL"); continue; }
  const htmlFile = new URL(`../test/real/snapshots/${page.id}.html`, import.meta.url);
  if (!existsSync(htmlFile)) { add("snapshot", false, `missing: run npm run snapshot -w @nordic/crawler -- ${page.id} <url>`); continue; }
  const html = readFileSync(htmlFile, "utf8");
  const info = JSON.parse(readFileSync(new URL(`../test/real/snapshots/${page.id}.json`, import.meta.url), "utf8")) as { url: string; capturedAt: string; sha256: string };
  const sha = createHash("sha256").update(html, "utf8").digest("hex");
  add("snapshot", sha === info.sha256 && info.url === page.url, `captured ${info.capturedAt}, sha256 ${sha.slice(0, 16)}…`);
  const s = extractStructure(html, page.selector, page.url);
  const e = page.expect;
  meta.push(`${page.id}: ${s.headings.length} headings, ${s.blocks.length} blocks, ${s.pairs.length} pairs, ${s.tables.length} tables, ${s.links.length} links, ${s.structuredData.length} structured-data adapters, truncated=${s.limits.truncated}`);
  for (const label of e.pairLabels ?? []) {
    const p = s.pairs.find((x) => x.label.toLowerCase() === label.toLowerCase());
    add(`pair "${label}"`, !!p, p ? `${p.from}, ${p.ref}, section [${p.section.join(" › ")}]` : "not found");
  }
  for (const [label, pattern] of Object.entries(e.pairValueMatches ?? {})) {
    const p = s.pairs.find((x) => x.label.toLowerCase() === label.toLowerCase());
    add(`pair "${label}" value ~ /${pattern}/`, !!p && new RegExp(pattern).test(p.value), p ? "" : "pair not found");
  }
  for (const heading of e.sections ?? []) {
    const n = s.blocks.filter((b) => b.section.includes(heading)).length;
    add(`blocks under "${heading}"`, n > 0, `${n} blocks`);
  }
  if (e.pdfLink !== undefined) add("pdf link", s.links.some((l) => l.fileType === "pdf") === e.pdfLink, s.links.filter((l) => l.fileType === "pdf").map((l) => l.ref).join(", "));
  const json = JSON.stringify(s);
  for (const needle of e.notInStructure ?? []) add(`no script state "${needle}"`, !json.includes(needle));
  if (e.minPairs !== undefined) add(`at least ${e.minPairs} pairs`, s.pairs.length >= e.minPairs, `${s.pairs.length} pairs`);
  add("deterministic", JSON.stringify(extractStructure(html, page.selector, page.url)) === json);
}

const failed = rows.filter((r) => !r.ok);
if (md) {
  console.log("| Page | University | Check | Result | Detail |\n|---|---|---|---|---|");
  for (const r of rows) console.log(`| ${r.id} | ${r.university} | ${r.check} | ${r.ok ? "✅ pass" : "❌ FAIL"} | ${r.detail.replace(/\|/g, "\\|")} |`);
  console.log(`\n${meta.map((m) => `- ${m}`).join("\n")}\n\n**${rows.length - failed.length} passed, ${failed.length} failed.**`);
} else {
  for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(18)} ${r.check}${r.detail ? `  (${r.detail})` : ""}`);
  for (const m of meta) console.log(`info  ${m}`);
  console.log(`${rows.length - failed.length} passed, ${failed.length} failed`);
}
process.exit(failed.length ? 1 : 0);
