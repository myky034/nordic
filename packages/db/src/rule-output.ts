// PR 2a (docs/architecture/l7b-pr2-architecture-review.md §5.2): the contract
// between the rule engine (extractor, PR 2b) and the code that will store its
// results (PR 3) or bind them to intakes (L7b). Types only plus two constant
// lists, so the web app, the extractor and later SQL-facing code share one
// definition. Nothing here touches the database.

/** Must match the CHECK on facts.value_period (migration 20261013090000_fact_types). */
export const VALUE_PERIODS = ["year", "semester", "month", "week", "total", "one_off"] as const;
export type ValuePeriod = (typeof VALUE_PERIODS)[number];

export const INTAKE_TERMS = ["spring", "summer", "autumn", "winter"] as const;
export type IntakeTerm = (typeof INTAKE_TERMS)[number];

/**
 * Where a piece of evidence sits inside ONE stored structure snapshot
 * (review §3.3). `field` picks exactly one string of exactly one element, so
 * evidence can never be assembled from unrelated elements:
 * - "text": heading / block / link text;
 * - "label" / "value": one side of a pair;
 * - "canonical": `label + ": " + value` of the same pair;
 * - "cell": one table cell, addressed by `cell` [row, column] (only then).
 * `excerpt` must be a substring of that string (after the database's
 * extraction_norm()). structureId is null until the snapshot is stored (tests).
 */
type EvidenceBase = { documentId: string; structureId: string | null; structureHash: string; ref: string; excerpt: string };
export type EvidenceRef =
  | (EvidenceBase & { field: "text" | "label" | "value" | "canonical"; cell?: never })
  | (EvidenceBase & { field: "cell"; cell: readonly [number, number] });

/**
 * When an intake starts, as the SOURCE states it: a term, a month, or both;
 * never neither (a year alone is not an intake). "Studies starting August
 * 2027" gives month 8 and no term; it is never turned into "autumn" here.
 */
type IntakeWhen = { term: IntakeTerm; month: number | null } | { term: null; month: number };

/**
 * A RESOLVED intake. `from` says what identifies it, and there is no "url"
 * option: a URL alone never decides the intake (review §1.5, D1).
 * - "heading": a heading in this document states it; `evidence` points at
 *   that heading in the structure snapshot.
 * - "page": the reviewed L7b records bind this page to the intake
 *   (programme_pages → programme_intakes). Their evidence is the excerpt on
 *   the intake record itself, not an element of this snapshot, so the
 *   reference carries the record ids instead (resolved in PR 3).
 * Intake text that cannot be resolved is not an IntakeRef: it is reported as
 * a RuleIssue of kind "intake_unresolved" with the text as found.
 */
export type IntakeRef = { label: string; year: number } & IntakeWhen & (
  | { from: "heading"; evidence: EvidenceRef }
  | { from: "page"; record: { programmePageId: string; intakeId: string } }
);

/** The structured reading of a value, in the shape facts.value_* expects. */
export type NormalizedValue = {
  number: string | null;
  currency: string | null;
  period: ValuePeriod | null;
  date: string | null;
  unit: string | null;
};

export type RuleMethod = "pair" | "section_lines" | "sentence" | "table" | "json_ld";

/**
 * One value a rule found. `raw` is always kept as the source wrote it;
 * `normalized` is null when no structured reading was possible.
 * `derivation` is always null in PR 2: values are extracted directly (D7).
 * `applicability` is set only when the evidence itself says so (Risk C);
 * appearing on an intake page is not enough.
 */
export type RuleCandidate = {
  kind: "candidate";
  ruleId: string;
  ruleVersion: number;
  rulesetVersion: string;
  factType: string;
  method: RuleMethod;
  raw: { text: string; unit: string | null };
  normalized: NormalizedValue | null;
  derivation: null;
  intake: IntakeRef | null;
  applicability: "intake" | "programme" | null;
  evidence: EvidenceRef;
  notes: string[];
};

/** Outcomes that are reported instead of guessed. */
export type RuleIssue = {
  kind: "not_found" | "ambiguous" | "intake_unresolved" | "normalize_failed";
  factType: string;
  ruleIds: string[];
  detail: string;
  candidates?: RuleCandidate[];
  /** For "intake_unresolved": the intake words as found (e.g. a heading without a year), verbatim. */
  intakeText?: string;
};

export type RuleOutput = RuleCandidate | RuleIssue;

// Run-time checks for values that cross a boundary (rules → PR 3 storage).
// The types above already rule these out in TypeScript; these catch data
// built from JSON or by hand. Each returns every problem found.

const isIndex = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;

export function evidenceRefProblems(e: EvidenceRef): string[] {
  const p: string[] = [];
  if (!e.documentId) p.push("evidence: documentId is empty");
  if (!/^[0-9a-f]{64}$/.test(e.structureHash)) p.push("evidence: structureHash must be 64 hex characters");
  if (!e.ref) p.push("evidence: ref is empty");
  if (!e.excerpt.trim()) p.push("evidence: excerpt is empty");
  if (e.field === "cell") {
    if (!Array.isArray(e.cell) || e.cell.length !== 2 || !e.cell.every(isIndex)) p.push("evidence: a cell needs [row, column] as whole numbers from 0");
  } else if ((e as { cell?: unknown }).cell !== undefined) p.push(`evidence: field "${e.field}" cannot have a cell`);
  if (!["text", "label", "value", "canonical", "cell"].includes(e.field)) p.push(`evidence: field "${e.field}" is unknown`);
  return p;
}

export function intakeRefProblems(i: IntakeRef): string[] {
  const p: string[] = [];
  if (!i.label.trim()) p.push("intake: label is empty");
  if (!Number.isInteger(i.year) || i.year < 2000 || i.year > 2100) p.push("intake: year must be a whole number 2000–2100");
  if (i.term !== null && !(INTAKE_TERMS as readonly string[]).includes(i.term)) p.push(`intake: term "${i.term}" is unknown`);
  if (i.month !== null && !(Number.isInteger(i.month) && i.month >= 1 && i.month <= 12)) p.push("intake: month must be 1–12");
  if (i.term === null && i.month === null) p.push("intake: a resolved intake needs a term or a month");
  const from = (i as { from: string }).from;
  if (from === "heading") p.push(...evidenceRefProblems((i as { evidence: EvidenceRef }).evidence));
  else if (from === "page") {
    const r = (i as { record?: { programmePageId?: string; intakeId?: string } }).record;
    if (!r?.programmePageId || !r.intakeId) p.push("intake: a page intake needs programmePageId and intakeId");
  } else p.push(`intake: source "${from}" is not allowed (a URL alone never decides an intake)`);
  return p;
}
