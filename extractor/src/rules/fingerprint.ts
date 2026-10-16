import { createHash } from "node:crypto";
import type { Rule } from "./types";

// PR 2a (review §5.3): a rule's version must change whenever its definition
// changes, so every stored result (rule_id + rule_version, PR 3) points to
// exactly one definition. The fingerprint is a hash of the definition with
// keys in a fixed order and patterns written as source + flags.
//
// Left out (M3, PR #5 review):
// - `version`, so raising it alone does not change the fingerprint;
// - `mode` and `enabled`: rollout state, not extraction semantics. Promoting
//   a rule from shadow to propose (D12 S6) keeps the same id + version, so
//   the results checked in shadow stay attributable to it. Those switches
//   are still reviewed, because they change only through a pull request.
// Everything else (scope, field, strategy, normalize, intake, evidence,
// priority, overrides, id) is in the fingerprint.
const OPERATIONAL = ["version", "mode", "enabled"] as const;

function canonical(value: unknown): unknown {
  if (value instanceof RegExp) return { regexp: value.source, flags: value.flags };
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort(compareCodeUnits).filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => [k, canonical((value as Record<string, unknown>)[k])]));
  }
  return value;
}

export function ruleFingerprint(rule: Rule): string {
  const definition = Object.fromEntries(Object.entries(rule).filter(([k]) => !(OPERATIONAL as readonly string[]).includes(k)));
  return createHash("sha256").update(JSON.stringify(canonical(definition))).digest("hex");
}

/** Code-unit order, independent of the machine's locale (M4: localeCompare is not). */
export const compareCodeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export type VersionLock = Readonly<Record<string, { version: number; fingerprint: string }>>;

/** Problems when the registry and the recorded versions disagree. */
export function checkVersions(rules: readonly Rule[], lock: VersionLock): string[] {
  const problems: string[] = [];
  for (const rule of rules) {
    const entry = lock[rule.id];
    const fingerprint = ruleFingerprint(rule);
    if (!entry) problems.push(`rule ${rule.id}: not recorded in versions.ts (add { version: ${rule.version}, fingerprint: "${fingerprint}" })`);
    else if (entry.version === rule.version && entry.fingerprint !== fingerprint) problems.push(`rule ${rule.id}: definition changed but version is still ${rule.version}; raise it`);
    else if (entry.version !== rule.version) problems.push(`rule ${rule.id}: version ${rule.version} differs from versions.ts (${entry.version}); update the record`);
  }
  for (const id of Object.keys(lock)) if (!rules.some((r) => r.id === id)) problems.push(`versions.ts lists ${id}, which is not in the registry`);
  return problems;
}

/**
 * Raised by hand whenever strategies, intake detection, precedence or a
 * normalizer change what the same rules produce (code, not configuration,
 * so no test can see it; the PR that changes them must raise it).
 * 1 = PR 2b.
 */
export const ENGINE_VERSION = 1;

/** Shared configuration that changes what rules produce without changing any rule (PR #6 review M4). */
export type RulesetDependencies = {
  /** Which pages a pageType scope matches. */
  pageTypes?: readonly { source: string; type: string; url: RegExp }[];
  /** Which fact types belong to an intake (applicability, D2). */
  intakeScope?: Readonly<Record<string, string>>;
};

/**
 * One string for a whole rule set and the configuration it runs with, so
 * outputs name the exact set that produced them. Independent of the order of
 * rules, page types and keys; `mode` and `enabled` stay out (rollout state).
 */
export function rulesetVersion(rules: readonly Rule[], deps: RulesetDependencies = {}): string {
  const parts = [...rules].sort((a, b) => compareCodeUnits(a.id, b.id)).map((r) => `${r.id}@${r.version}:${ruleFingerprint(r)}`);
  const pageTypes = [...(deps.pageTypes ?? [])].map((d) => JSON.stringify(canonical(d))).sort(compareCodeUnits);
  const intakeScope = JSON.stringify(canonical(deps.intakeScope ?? {}));
  const all = [`engine@${ENGINE_VERSION}`, ...parts, "page-types", ...pageTypes, "intake-scope", intakeScope].join("\n");
  return `ruleset-${createHash("sha256").update(all).digest("hex").slice(0, 12)}`;
}
