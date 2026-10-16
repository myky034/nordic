import { describe, expect, it } from "vitest";
import { eligibleForAutoProposal, evidenceRefProblems, intakeRefProblems, type EvidenceRef, type IntakeRef, type RuleCandidate, type SuppressedCandidate } from "@nordic/db/rule-output";

// Task 5 of the PR #5 review: the shared contracts cannot express evidence
// with a stray cell, an intake without a term or month, or an intake from a
// URL; a page-bound intake points at the reviewed L7b records.

const hash = "a".repeat(64);
const textEvidence: EvidenceRef = { documentId: "d1", structureId: null, structureHash: hash, ref: "h3", field: "text", excerpt: "Autumn 2027" };
const cellEvidence: EvidenceRef = { documentId: "d1", structureId: "s1", structureHash: hash, ref: "t1", field: "cell", cell: [2, 1], excerpt: "135000 SEK" };

describe("EvidenceRef", () => {
  it("accepts text and cell evidence", () => {
    expect(evidenceRefProblems(textEvidence)).toEqual([]);
    expect(evidenceRefProblems(cellEvidence)).toEqual([]);
  });
  it("allows a cell coordinate only for field cell (type and run time)", () => {
    // @ts-expect-error: a coordinate on non-cell evidence does not type-check.
    const stray: EvidenceRef = { ...textEvidence, cell: [0, 0] };
    expect(evidenceRefProblems(stray)).toEqual(['evidence: field "text" cannot have a cell']);
    // @ts-expect-error: cell evidence without its coordinate does not type-check.
    const missing: EvidenceRef = { ...textEvidence, field: "cell" };
    expect(evidenceRefProblems(missing)).toEqual(["evidence: a cell needs [row, column] as whole numbers from 0"]);
    expect(evidenceRefProblems({ ...cellEvidence, cell: [-1, 0.5] })).toEqual(["evidence: a cell needs [row, column] as whole numbers from 0"]);
  });
  it("JSON-LD evidence needs an sd<adapter>.<item> ref and a path; other fields cannot carry a path (M5)", () => {
    const jsonLd: EvidenceRef = { documentId: "d1", structureId: null, structureHash: hash, ref: "sd0.1", field: "json_ld", path: ["offers", 0, "price"], excerpt: "15000" };
    expect(evidenceRefProblems(jsonLd)).toEqual([]);
    expect(evidenceRefProblems({ ...jsonLd, ref: "p1" })).toEqual(['evidence: a JSON-LD ref must be "sd<adapter>.<item>"']);
    expect(evidenceRefProblems({ ...jsonLd, path: [] })).toEqual(["evidence: a JSON-LD path needs keys (non-empty text) or indexes (whole numbers from 0)"]);
    expect(evidenceRefProblems({ ...jsonLd, path: ["", -1] })).toEqual(["evidence: a JSON-LD path needs keys (non-empty text) or indexes (whole numbers from 0)"]);
    // @ts-expect-error: JSON-LD evidence without a path does not type-check.
    const noPath: EvidenceRef = { ...textEvidence, ref: "sd0.0", field: "json_ld" };
    expect(evidenceRefProblems(noPath)).toEqual(["evidence: a JSON-LD path needs keys (non-empty text) or indexes (whole numbers from 0)"]);
    // @ts-expect-error: a path on text evidence does not type-check.
    const strayPath: EvidenceRef = { ...textEvidence, path: ["name"] };
    expect(evidenceRefProblems(strayPath)).toEqual(['evidence: field "text" cannot have a JSON path']);
  });
  it("rejects empty excerpts and malformed hashes", () => {
    expect(evidenceRefProblems({ ...textEvidence, excerpt: " ", structureHash: "x" })).toEqual([
      "evidence: structureHash must be 64 hex characters", "evidence: excerpt is empty",
    ]);
  });
});

describe("IntakeRef", () => {
  const heading: IntakeRef = { label: "Autumn 2027", year: 2027, term: "autumn", month: null, from: "heading", evidence: textEvidence };
  const month: IntakeRef = { label: "studies starting August 2027", year: 2027, term: null, month: 8, from: "heading", evidence: textEvidence };
  const page: IntakeRef = { label: "Autumn 2027", year: 2027, term: "autumn", month: null, from: "page", record: { programmePageId: "p1", intakeId: "i1" } };
  it("accepts a term, a month, or a page-bound intake", () => {
    for (const i of [heading, month, page]) expect(intakeRefProblems(i)).toEqual([]);
  });
  it("a resolved intake needs a term or a month (type and run time)", () => {
    // @ts-expect-error: neither term nor month: not a resolved intake.
    const neither: IntakeRef = { ...heading, term: null, month: null };
    expect(intakeRefProblems(neither)).toEqual(["intake: a resolved intake needs a term or a month"]);
  });
  it("a heading intake carries snapshot evidence; a page intake carries the reviewed record ids", () => {
    // @ts-expect-error: a page intake is identified by its L7b records, not by snapshot evidence.
    const pageWithEvidence: IntakeRef = { ...heading, from: "page" };
    expect(intakeRefProblems(pageWithEvidence)).toEqual(["intake: a page intake needs programmePageId and intakeId"]);
    expect(intakeRefProblems({ ...heading, evidence: { ...textEvidence, excerpt: "" } })).toEqual(["evidence: excerpt is empty"]);
  });
  it("never from a URL, and only plausible years and months", () => {
    // @ts-expect-error: "url" is not a source of an intake.
    const fromUrl: IntakeRef = { ...heading, from: "url" };
    expect(intakeRefProblems(fromUrl)).toEqual(['intake: source "url" is not allowed (a URL alone never decides an intake)']);
    expect(intakeRefProblems({ ...month, month: 13, year: 27 })).toEqual(["intake: year must be a whole number 2000–2100", "intake: month must be 1–12"]);
  });
});

describe("SuppressedCandidate (M1, PR #6)", () => {
  const candidate: RuleCandidate = { kind: "candidate", ruleId: "x.site", ruleVersion: 1, rulesetVersion: "ruleset-000000000000", factType: "teaching_language",
    method: "pair", raw: { text: "Swedish", unit: null }, normalized: null, derivation: null, intake: null, applicability: null, evidence: textEvidence, notes: [] };
  const { suppressed: _none, ...inner } = { ...candidate, ruleId: "x.global", raw: { text: "English", unit: null } };
  const entry: SuppressedCandidate = { reason: "lower_specificity", candidate: inner };
  it("is optional: candidates without it are unchanged and eligible", () => {
    expect(eligibleForAutoProposal(candidate)).toBe(true);
    expect(eligibleForAutoProposal({ ...candidate, suppressed: [entry] })).toBe(false);
  });
  it("cannot nest: a suppressed candidate has no suppressed list of its own", () => {
    // @ts-expect-error: a suppressed candidate cannot carry `suppressed` (no recursion).
    const nested: SuppressedCandidate = { reason: "lower_priority", candidate: { ...inner, suppressed: [entry] } };
    expect(nested.reason).toBe("lower_priority");
    // @ts-expect-error: only the two precedence reasons exist.
    const other: SuppressedCandidate["reason"] = "conflict";
    expect(other).toBe("conflict");
  });
});
