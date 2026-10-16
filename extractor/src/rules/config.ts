import { INTAKE_SCOPE, KNOWN_FACT_TYPES, type ValueKind } from "./fact-types";
import type { NormalizeSpec, Rule, RuleScope } from "./types";

// PR 2a (review §5.3): checks every rule definition before it can be used.
// Run in tests (registry.test.ts), not at crawl time: a broken rule must fail
// the pull request that introduces it. Returns all problems, not the first.

const ID = /^[a-z0-9]+(?:\.[a-z0-9_]+)+$/;
const ORIGIN = /^https:\/\/[a-z0-9.-]+$/;
const COUNTRY = /^[a-z]+(?:-[a-z]+)*$/;
const NORMALIZERS_FOR: Record<ValueKind, readonly NormalizeSpec["kind"][]> = {
  money: ["money"], date: ["date"], number: ["duration", "credits", "pace"], text: ["text"],
};

/** A pattern that matches a whole string: anchored, and without stateful flags (g / y keep lastIndex). */
function patternProblem(re: RegExp, what: string, anchored: boolean) {
  if (/[gy]/.test(re.flags)) return `${what}: flags g and y are not allowed (they make matching depend on earlier calls)`;
  if (anchored && !(re.source.startsWith("^") && re.source.endsWith("$"))) return `${what}: must be anchored with ^ and $`;
  return null;
}

/** Equal scopes compare equal: keys in a fixed order, patterns by source and flags. */
export const scopeKey = (s: RuleScope) =>
  JSON.stringify([s.country ?? null, s.source ?? null, s.pageType ?? null, s.page ? `${s.page.source}/${s.page.flags}` : null]);

export function validateRules(rules: readonly Rule[], factTypes: Readonly<Record<string, ValueKind>> = KNOWN_FACT_TYPES): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const rule of rules) {
    const at = `rule ${rule.id || "(no id)"}`;
    const add = (p: string | null) => p && problems.push(`${at}: ${p}`);
    if (!ID.test(rule.id)) add("id must be dotted lower case, e.g. su.tuition.pair");
    if (ids.has(rule.id)) add("id is used twice");
    ids.add(rule.id);
    if (!Number.isInteger(rule.version) || rule.version < 1) add("version must be a whole number from 1");
    if (!Number.isInteger(rule.priority)) add("priority must be a whole number");
    if (rule.mode !== "shadow" && rule.mode !== "propose") add('mode must be "shadow" or "propose"');
    if (!["text", "label", "value", "canonical", "cell", "json_ld"].includes(rule.evidence)) add("evidence field is unknown");

    const kind = factTypes[rule.field];
    if (!kind) add(`field "${rule.field}" is not a known fact type`);
    else if (!NORMALIZERS_FOR[kind].includes(rule.normalize.kind)) add(`normalizer "${rule.normalize.kind}" does not suit a ${kind} fact type`);

    const { scope } = rule;
    if (scope.source !== undefined && !ORIGIN.test(scope.source)) add("scope.source must be an https origin without a path");
    if (scope.country !== undefined && !COUNTRY.test(scope.country)) add("scope.country must be a country slug");
    if (scope.pageType !== undefined && !scope.pageType.trim()) add("scope.pageType is empty");
    if (scope.page) add(patternProblem(scope.page, "scope.page", true));
    if (scope.page && !scope.source) add("scope.page needs scope.source");

    const s = rule.strategy;
    switch (s.kind) {
      case "pair":
        if (!s.labels.length || s.labels.some((l) => !l.trim())) add("pair strategy needs non-empty labels");
        // The excerpt must contain the value it supports: "label" alone would not (PR #6 review m2).
        if (rule.evidence !== "value" && rule.evidence !== "canonical") add('pair strategy takes evidence "value" or "canonical"');
        break;
      case "section_lines":
        add(patternProblem(s.heading, "section_lines.heading", true));
        add(patternProblem(s.line, "section_lines.line", true));
        break;
      case "sentence":
        if (s.heading) add(patternProblem(s.heading, "sentence.heading", true));
        add(patternProblem(s.pattern, "sentence.pattern", false));
        break;
      case "table":
        if (!s.columnHeader.trim()) add("table strategy needs a column header");
        if (rule.evidence !== "cell") add('table strategy takes evidence "cell"');
        break;
      case "json_ld":
        if (!s.type.trim() || !s.path.length) add("json_ld strategy needs a type and a path");
        if (rule.evidence !== "json_ld") add('json_ld strategy takes evidence "json_ld"');
        break;
      default:
        add(`strategy "${(s as { kind: string }).kind}" is unknown`);
    }
    if ((s.kind === "section_lines" || s.kind === "sentence") && rule.evidence !== "text") add(`${s.kind} strategy takes evidence "text"`);

    const intake = rule.intake as { from: string; pattern?: RegExp };
    if (intake.from === "heading") {
      if (!intake.pattern) add("intake from heading needs a pattern");
      else {
        add(patternProblem(intake.pattern, "intake.pattern", true));
        if (!/\(\?<year>/.test(intake.pattern.source)) add("intake.pattern must capture the year as (?<year>…)");
        if (!/\(\?<(?:term|month)>/.test(intake.pattern.source)) add("intake.pattern must capture (?<term>…) or (?<month>…): a year alone is not an intake");
      }
    } else if (intake.from !== "page" && intake.from !== "none") {
      add(`intake source "${intake.from}" is not allowed (a URL alone never decides an intake)`);
    }
    // D2 / Risk C: only intake-specific fact types may take an intake from context.
    if (intake.from !== "none" && INTAKE_SCOPE[rule.field] !== "intake") {
      add(`field "${rule.field}" is not intake-specific; it cannot take an intake from a ${intake.from} (being on an intake page is not evidence)`);
    }
  }
  // Second pass: references and collisions need the full list.
  const byId = new Map(rules.map((r) => [r.id, r]));
  for (const rule of rules) {
    for (const o of rule.overrides ?? []) {
      const target = byId.get(o);
      if (!target) problems.push(`rule ${rule.id}: overrides unknown rule ${o}`);
      else if (o === rule.id) problems.push(`rule ${rule.id}: overrides itself`);
      else if (target.field !== rule.field) problems.push(`rule ${rule.id}: overrides ${o}, which targets another field`);
    }
  }
  const seen = new Map<string, string>();
  for (const rule of rules) {
    const key = `${rule.field}|${scopeKey(rule.scope)}|${rule.priority}`;
    const other = seen.get(key);
    if (other) problems.push(`rule ${rule.id}: same field, scope and priority as ${other} (the order would be undefined)`);
    else seen.set(key, rule.id);
  }
  return problems;
}
