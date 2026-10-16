import type { ValuePeriod } from "@nordic/db/rule-output";

// PR 2a (review §5.3): what a rule IS. Rules are typed TypeScript data in the
// repository, reviewed through pull requests (D11). There is no rule table,
// no rule editor and no user-supplied code: a rule can only choose among the
// strategies and normalizers below. PR 2b adds the engine that runs them.

/**
 * Where a rule applies. An empty scope is global. The more fields, the more
 * specific (review §5.4: page > pageType > source > country > global).
 * - country: a country slug (e.g. "sweden");
 * - source: the origin of a registered source, e.g. "https://www.su.se";
 * - pageType: a page kind named by the site rules (e.g. "programme_intake");
 * - page: an anchored pattern over the page URL, for one-off exceptions.
 */
export type RuleScope = { country?: string; source?: string; pageType?: string; page?: RegExp };

/** How the value is found in a structure snapshot (html-structure-v1). Anchored patterns match a whole string. */
export type Strategy =
  | { kind: "pair"; labels: readonly string[]; section?: readonly string[] }
  | { kind: "section_lines"; heading: RegExp; line: RegExp }
  | { kind: "sentence"; heading?: RegExp; pattern: RegExp }
  | { kind: "table"; columnHeader: string; rowLabel?: string }
  | { kind: "json_ld"; type: string; path: readonly string[] };

/** Which normalizer reads the value; must suit the fact type's value kind. */
export type NormalizeSpec =
  | { kind: "duration" }
  | { kind: "credits" }
  | { kind: "money"; periods?: Readonly<Record<string, ValuePeriod>> }
  | { kind: "date"; order?: "dmy" | "mdy" }
  | { kind: "pace" }
  | { kind: "text" };

/**
 * Where the intake comes from. There is deliberately no "url" option: a URL
 * alone never decides an intake (review §1.5, D1).
 * - heading: an anchored pattern over the section heading; it must capture the year;
 * - page: the intake registered for the page (programme_pages, L7b; used from PR 3);
 * - none: the value does not belong to an intake.
 */
export type IntakeSpec = { from: "heading"; pattern: RegExp } | { from: "page" } | { from: "none" };

export type Rule = {
  /** Stable, dotted, lower case: "su.tuition.pair". */
  id: string;
  /** Raised on every change of the definition (checked by fingerprint, versions.ts). */
  version: number;
  enabled: boolean;
  /** "shadow" until promoted through the D12 criteria; "propose" only by a reviewed PR. */
  mode: "shadow" | "propose";
  priority: number;
  scope: RuleScope;
  /** A key of fact_types (fact-types.ts). */
  field: string;
  strategy: Strategy;
  normalize: NormalizeSpec;
  intake: IntakeSpec;
  /** Which string of the matched element becomes the excerpt (review §3.3). */
  evidence: "text" | "label" | "value" | "canonical" | "cell";
  /** Ids of less specific rules this one replaces for the same field. */
  overrides?: readonly string[];
};
