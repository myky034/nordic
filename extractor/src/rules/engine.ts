import type { DocumentStructure } from "@nordic/db/document-structure";
import { evidenceRefProblems, type EvidenceRef, type IntakeRef, type NormalizedValue, type RuleCandidate, type RuleIssue, type RuleOutput } from "@nordic/db/rule-output";
import { INTAKE_SCOPE } from "./fact-types";
import { compareCodeUnits, rulesetVersion } from "./fingerprint";
import { intakeFromHeading, type PageIntake } from "./intake";
import { applicableRules, pageContext, specificity, type PageTypeDef } from "./match";
import { normalize } from "./normalizers";
import { elementString, findHits, type Hit } from "./strategies";
import type { Rule } from "./types";

// PR 2b (review §5.4–§5.8): runs rules over ONE structure snapshot and returns
// RuleOutput (PR 2a contract). Pure and deterministic: no clock, network or
// randomness; the output order does not depend on the order of `rules`.
// Nothing here stores anything or calls the database (PR 3 does that).
//
// Safety rules enforced here:
// - an intake comes only from a stated heading or the reviewed page binding
//   (never a URL, never a yearless date), and only for intake-specific types;
// - applicability is "intake" only when the type is intake-specific (D2) AND
//   the intake was resolved; otherwise null (Risk C);
// - for each fact type and intake, the most specific rules win; when they
//   disagree the result is "ambiguous" and no candidate is emitted;
// - a rule that finds nothing is reported as "not_found";
// - every candidate's excerpt is checked against the element it names.

export type EngineInput = {
  documentId: string;
  structureId: string | null;
  structureHash: string;
  structure: DocumentStructure;
  pageUrl: string;
  country: string | null;
  /** The intake the reviewed L7b records bind this page to (PR 3); absent until then. */
  pageIntake?: PageIntake | null;
};

type Found = { rule: Rule; level: number; hit: Hit; candidate: RuleCandidate };
type Raised = { rule: Rule; level: number; issue: RuleIssue };

const EMPTY = (v: NormalizedValue) => Object.values(v).every((x) => x === null);
const intakeKey = (i: IntakeRef | null) => (i ? `${i.year}|${i.term ?? ""}|${i.month ?? ""}` : "");
const byOrder = (a: Hit, b: Hit) => a.order[0] - b.order[0] || a.order[1] - b.order[1];

/** The excerpt must sit inside the one element string the hit names; a miss is a bug in a strategy. */
function verifyHit(s: DocumentStructure, hit: Hit) {
  const target = elementString(s, hit);
  if (target === null || !target.includes(hit.excerpt)) throw new Error(`rule engine: excerpt not found in ${hit.ref}/${hit.field}`);
}

/** Input the engine cannot work with (PR #6 review m3): reported with its reason, never a bare TypeError. */
export class EngineInputError extends Error {
  constructor(message: string) { super(`rule engine input: ${message}`); this.name = "EngineInputError"; }
}

export function runRules(input: EngineInput, rules: readonly Rule[], pageTypes: readonly PageTypeDef[]): RuleOutput[] {
  if (!URL.canParse(input.pageUrl) || !/^https?:$/.test(new URL(input.pageUrl).protocol)) throw new EngineInputError(`page URL "${input.pageUrl}" is not an http(s) URL`);
  const page = pageContext(input.pageUrl, input.country, pageTypes);
  // M4: the ruleset id also covers the shared configuration that changes results.
  const ruleset = rulesetVersion(rules, { pageTypes, intakeScope: INTAKE_SCOPE });
  const doc = { documentId: input.documentId, structureId: input.structureId, structureHash: input.structureHash };
  const found: Found[] = [];
  const raised: Raised[] = [];
  const active = applicableRules(rules, page).sort((a, b) => compareCodeUnits(a.id, b.id));

  for (const rule of active) {
    const level = specificity(rule.scope);
    const hits = findHits(input.structure, rule.strategy, rule.evidence).sort(byOrder);
    if (!hits.length) {
      raised.push({ rule, level, issue: { kind: "not_found", factType: rule.field, ruleIds: [rule.id], detail: `${rule.strategy.kind} found nothing` } });
      continue;
    }
    for (const hit of hits) {
      verifyHit(input.structure, hit);
      let intake: IntakeRef | null = null;
      if (rule.intake.from !== "none") {
        const r = rule.intake.from === "heading" ? intakeFromHeading(input.structure, doc, hit.section, rule.intake.pattern)
          : input.pageIntake ? { intake: input.pageIntake } : { unresolved: null };
        if ("unresolved" in r) {
          raised.push({ rule, level, issue: { kind: "intake_unresolved", factType: rule.field, ruleIds: [rule.id],
            detail: r.unresolved ? `"${r.unresolved}" names no term or month, or is not a heading` : `no intake ${rule.intake.from === "page" ? "is bound to this page" : "heading above"} ${hit.ref}`,
            ...(r.unresolved ? { intakeText: r.unresolved } : {}) } });
          continue;
        }
        intake = r.intake;
      }
      const result = normalize(rule.normalize, hit.value);
      if (result.failure) {
        raised.push({ rule, level, issue: { kind: "normalize_failed", factType: rule.field, ruleIds: [rule.id], detail: `${hit.ref}: ${result.failure.code}: ${result.failure.detail}` } });
        continue;
      }
      const evidence = { ...doc, ref: hit.ref, field: hit.field, excerpt: hit.excerpt,
        ...(hit.field === "cell" ? { cell: hit.cell } : {}), ...(hit.field === "json_ld" ? { path: hit.path } : {}) } as EvidenceRef;
      const problems = evidenceRefProblems(evidence);
      if (problems.length) throw new Error(`rule engine: invalid evidence for ${rule.id}: ${problems.join("; ")}`);
      for (const reading of result.readings) {
        const value = reading.status === "ok" && !EMPTY(reading.value) ? reading.value : null;
        const notes = reading.status === "unresolved" ? [...reading.notes, `${reading.reason.code}: ${reading.reason.detail}`] : reading.notes;
        found.push({ rule, level, hit, candidate: {
          kind: "candidate", ruleId: rule.id, ruleVersion: rule.version, rulesetVersion: ruleset, factType: rule.field, method: rule.strategy.kind,
          raw: { text: reading.text, unit: result.raw.unit }, normalized: value, derivation: null, intake,
          applicability: intake && INTAKE_SCOPE[rule.field] === "intake" ? "intake" : null, evidence, notes,
        } });
      }
    }
  }
  return resolve(found, raised);
}

/** Candidates found by one rule in one element with one excerpt: one statement, possibly several readings. */
function statementsOf(list: Found[]): Found[][] {
  const statements = new Map<string, Found[]>();
  for (const f of [...list].sort((a, b) => byOrder(a.hit, b.hit) || compareCodeUnits(a.rule.id, b.rule.id))) {
    // The same excerpt from another element or rule is a repeat of the statement, kept once.
    const first = statements.get(f.hit.excerpt);
    if (!first) statements.set(f.hit.excerpt, [f]);
    else if (first[0].hit.ref === f.hit.ref && first[0].rule.id === f.rule.id) first.push(f);
  }
  return [...statements.values()];
}

/**
 * What a statement says, for comparing statements (M1). A reading with a
 * normalized value compares by that value, so "2 years" and "24 months"
 * (both 24 months) agree and "100000 SEK" vs "120000 SEK", or SEK vs EUR,
 * do not. A reading without one (text types, or unresolved values such as
 * "15 January") compares by its words, ignoring case and spacing only: when
 * the comparison is not safe, different wording stays a difference.
 */
function meaning(statement: Found[]) {
  const keys = statement.map(({ candidate: c }) => (c.normalized ? `v:${JSON.stringify(c.normalized)}` : `t:${c.raw.text.trim().replace(/\s+/g, " ").toLowerCase()}`));
  return [...new Set(keys)].sort(compareCodeUnits).join("\u0001");
}

const plain = ({ suppressed: _omit, ...c }: RuleCandidate): Omit<RuleCandidate, "suppressed"> => c;

/**
 * Per fact type AND intake (PR #6 review M2): the most specific level that
 * produced a candidate for that intake wins, then the highest priority.
 * Candidates of different intakes never suppress one another; "no intake"
 * (a programme-level type) is its own group, and an unresolved intake is
 * not a group at all: it is an intake_unresolved issue.
 * - Winning rules with two different statements → "ambiguous", nothing chosen.
 * - Lower-precedence statements that MEAN the same as the winner are
 *   duplicates and are not repeated.
 * - Lower-precedence statements that mean something else are kept in the
 *   winner's `suppressed` (M1) with the reason, never dropped; such a winner
 *   is not eligible for automatic proposal (eligibleForAutoProposal).
 */
function resolve(found: Found[], raised: Raised[]): RuleOutput[] {
  const out: RuleOutput[] = [];
  const groups = new Map<string, Found[]>();
  for (const f of found) {
    const key = `${f.candidate.factType}\u0000${intakeKey(f.candidate.intake)}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  for (const key of [...groups.keys()].sort(compareCodeUnits)) {
    const all = groups.get(key)!;
    const level = Math.max(...all.map((f) => f.level));
    const top = Math.max(...all.filter((f) => f.level === level).map((f) => f.rule.priority));
    const isWinner = (f: Found) => f.level === level && f.rule.priority === top;
    const kept = statementsOf(all.filter(isWinner));
    // Set-aside statements, most precedent first (level, priority, rule id, document order).
    const losers = statementsOf(all.filter((f) => !isWinner(f)))
      .sort((a, b) => b[0].level - a[0].level || b[0].rule.priority - a[0].rule.priority || compareCodeUnits(a[0].rule.id, b[0].rule.id) || byOrder(a[0].hit, b[0].hit));
    const withSuppressed = (statement: Found[]): RuleCandidate[] => {
      const says = meaning(statement);
      const suppressed = losers.filter((l) => meaning(l) !== says).flatMap((l) => l.map((f) => ({
        reason: f.level < level ? "lower_specificity" as const : "lower_priority" as const, candidate: plain(f.candidate) })));
      return statement.map((f) => (suppressed.length ? { ...f.candidate, suppressed } : f.candidate));
    };
    if (kept.length > 1) {
      const ruleIds = [...new Set(kept.flat().map((f) => f.rule.id))].sort(compareCodeUnits);
      out.push({ kind: "ambiguous", factType: all[0].candidate.factType, ruleIds,
        detail: `${kept.length} different statements: ${kept.map((k) => `${k[0].hit.ref} "${k[0].hit.excerpt}"`).join(" / ")}`,
        candidates: kept.flatMap(withSuppressed) });
    } else {
      out.push(...withSuppressed(kept[0]));
    }
  }
  // Issues are never dropped by precedence: an intake that could not be
  // resolved, or a value the normalizer refused, is reported whichever rule
  // found it. "not_found" means the fact type has no candidate at all.
  const withCandidates = new Set(found.map((f) => f.candidate.factType));
  const notFound = new Map<string, Raised[]>();
  for (const r of raised) {
    if (r.issue.kind !== "not_found") out.push(r.issue);
    else if (!withCandidates.has(r.issue.factType)) notFound.set(r.issue.factType, [...(notFound.get(r.issue.factType) ?? []), r]);
  }
  for (const [factType, rs] of notFound) {
    out.push({ kind: "not_found", factType, ruleIds: rs.map((r) => r.rule.id).sort(compareCodeUnits), detail: rs.map((r) => `${r.rule.id}: ${r.issue.detail}`).sort(compareCodeUnits).join("; ") });
  }
  return sortOutputs(out);
}

const KIND_RANK: Record<RuleOutput["kind"], number> = { candidate: 0, ambiguous: 1, intake_unresolved: 2, normalize_failed: 3, not_found: 4 };
function sortOutputs(out: RuleOutput[]) {
  const key = (o: RuleOutput) => o.kind === "candidate"
    ? [o.factType, KIND_RANK[o.kind], intakeKey(o.intake), o.ruleId, o.evidence.ref, o.raw.text].join("\u0000")
    : [o.factType, KIND_RANK[o.kind], "", o.ruleIds.join(","), o.detail].join("\u0000");
  return out.map((o) => [key(o), o] as const).sort((a, b) => compareCodeUnits(a[0], b[0])).map(([, o]) => o);
}
