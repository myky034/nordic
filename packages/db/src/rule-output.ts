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
 * - "cell": one table cell, addressed by `cell` [row, column].
 * `excerpt` must be a substring of that string (after the database's
 * extraction_norm()). structureId is null until the snapshot is stored (tests).
 */
export type EvidenceRef = {
  documentId: string;
  structureId: string | null;
  structureHash: string;
  ref: string;
  field: "text" | "label" | "value" | "canonical" | "cell";
  cell?: [number, number];
  excerpt: string;
};

/**
 * An intake as the SOURCE states it. Only stated words are kept: "studies
 * starting August 2027" gives month 8 and no term; it is never turned into
 * "autumn" here. `from` has no "url" option on purpose: a URL alone never
 * decides the intake (review §1.5, D1).
 */
export type IntakeRef = {
  label: string;
  year: number;
  term: IntakeTerm | null;
  month: number | null;
  from: "heading" | "page";
  evidence: EvidenceRef;
};

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
};

export type RuleOutput = RuleCandidate | RuleIssue;
