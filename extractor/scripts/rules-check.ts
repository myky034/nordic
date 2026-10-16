// PR 2b real-page acceptance (local only; run: npm run rules:check -w @nordic/extractor).
// Reads the git-ignored snapshots of real pages (crawler/test/real/snapshots,
// captured with `npm run snapshot -w @nordic/crawler`), builds their structure
// with the crawler's own extractor, runs the rules and compares with
// test/real/rules-expectations.json. A missing snapshot or a missing
// expectation is a FAIL, never a skip. Nothing is fetched or stored.
// Not part of the extractor build: it imports crawler code at run time (tsx).
import { readFileSync, readdirSync } from "node:fs";
import { evidenceRefProblems, type RuleCandidate, type RuleOutput } from "@nordic/db/rule-output";
import { extractStructure } from "../../crawler/src/structure";
import { runRules } from "../src/rules/engine";
import { elementString } from "../src/rules/strategies";
import { PAGE_TYPES, RULES } from "../src/rules/registry";

type Expected = { factType: string; raw: string; number?: string; unit?: string; currency?: string; period?: string; unresolved?: string;
  intake: { year: number; term: string | null; month: number | null } | null; applicability: string | null };
const root = new URL("../../crawler/test/real/", import.meta.url);
const pages = (JSON.parse(readFileSync(new URL("expectations.json", root), "utf8")).pages) as { id: string; url: string; selector: string | null }[];
const expected = JSON.parse(readFileSync(new URL("../test/real/rules-expectations.json", import.meta.url), "utf8")).pages as
  Record<string, { candidates: Expected[]; notFound: string[]; forbiddenIntakeYears: number[] }>;
const snapshots = readdirSync(new URL("snapshots/", root));

let passed = 0, failed = 0;
const check = (ok: boolean, what: string) => { if (ok) passed++; else { failed++; console.log(`FAIL  ${what}`); } };
const shape = (c: RuleCandidate): Expected => ({
  factType: c.factType, raw: c.raw.text,
  ...(c.normalized?.number ? { number: c.normalized.number } : {}), ...(c.normalized?.unit ? { unit: c.normalized.unit } : {}),
  ...(c.normalized?.currency ? { currency: c.normalized.currency } : {}), ...(c.normalized?.period ? { period: c.normalized.period } : {}),
  ...(c.normalized === null && c.notes.some((n) => /^[a-z_]+:/.test(n)) ? { unresolved: c.notes.find((n) => /^[a-z_]+:/.test(n))!.split(":")[0] } : {}),
  intake: c.intake ? { year: c.intake.year, term: c.intake.term, month: c.intake.month } : null, applicability: c.applicability });
const key = (e: Expected) => JSON.stringify(Object.keys(e).sort().map((k) => [k, (e as Record<string, unknown>)[k]]));

for (const page of pages) {
  const want = expected[page.id];
  check(!!want, `${page.id}: expectations exist`);
  const file = snapshots.find((f) => f.startsWith(page.id) && f.endsWith(".html"));
  check(!!file, `${page.id}: local snapshot exists (npm run snapshot -w @nordic/crawler -- ${page.id} <url>)`);
  if (!want || !file) continue;
  const structure = extractStructure(readFileSync(new URL(`snapshots/${file}`, root), "utf8"), page.selector, page.url);
  const input = { documentId: page.id, structureId: null, structureHash: "0".repeat(64), structure, pageUrl: page.url, country: "sweden" };
  const out: RuleOutput[] = runRules(input, RULES, PAGE_TYPES);
  // Deterministic: a second run and a reversed registry give the same output.
  check(JSON.stringify(runRules(input, [...RULES].reverse(), PAGE_TYPES)) === JSON.stringify(out), `${page.id}: rule order does not change the output`);
  const cands = out.filter((o): o is RuleCandidate => o.kind === "candidate");
  const got = cands.map(shape).map(key).sort();
  const exp = want.candidates.map(key).sort();
  check(JSON.stringify(got) === JSON.stringify(exp), `${page.id}: candidates\n      got  ${got.join("\n           ")}\n      want ${exp.join("\n           ")}`);
  const notFound = out.filter((o) => o.kind === "not_found").map((o) => o.factType).sort();
  check(JSON.stringify(notFound) === JSON.stringify([...want.notFound].sort()), `${page.id}: not_found ${notFound.join(",")} vs ${want.notFound.join(",")}`);
  const others = out.filter((o) => o.kind !== "candidate" && o.kind !== "not_found");
  check(others.length === 0, `${page.id}: no ambiguous / intake_unresolved / normalize_failed (${others.map((o) => o.kind).join(",")})`);
  for (const c of cands) {
    check(evidenceRefProblems(c.evidence).length === 0 && (elementString(structure, c.evidence) ?? "").includes(c.evidence.excerpt), `${page.id}: evidence of ${c.ruleId} is inside ${c.evidence.ref}`);
    check(!c.intake || !want.forbiddenIntakeYears.includes(c.intake.year), `${page.id}: ${c.ruleId} has no intake year from another intake`);
  }
  console.log(`info  ${page.id}: ${cands.length} candidates, not_found ${notFound.join(",") || "-"}`);
}
// Every expectation must be checked: a page listed here but missing from the
// crawler's page list would otherwise pass unnoticed (PR #6 review m5).
for (const id of Object.keys(expected)) check(pages.some((p) => p.id === id), `${id}: expected in rules-expectations.json but not in crawler/test/real/expectations.json`);
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
