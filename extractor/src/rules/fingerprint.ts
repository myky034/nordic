import { createHash } from "node:crypto";
import type { Rule } from "./types";

// PR 2a (review §5.3): a rule's version must change whenever its definition
// changes, so every stored result (rule_id + rule_version, PR 3) points to
// exactly one definition. The fingerprint is a hash of the definition with
// keys in a fixed order and patterns written as source + flags; `version`
// itself is left out, so raising it alone does not change the fingerprint.

function canonical(value: unknown): unknown {
  if (value instanceof RegExp) return { regexp: value.source, flags: value.flags };
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => [k, canonical((value as Record<string, unknown>)[k])]));
  }
  return value;
}

export function ruleFingerprint(rule: Rule): string {
  const { version: _version, ...definition } = rule;
  return createHash("sha256").update(JSON.stringify(canonical(definition))).digest("hex");
}

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

/** One string for a whole rule set, sorted by id, so outputs can name the exact set that produced them. */
export function rulesetVersion(rules: readonly Rule[]): string {
  const parts = [...rules].sort((a, b) => a.id.localeCompare(b.id)).map((r) => `${r.id}@${r.version}:${ruleFingerprint(r)}`);
  return `ruleset-${createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 12)}`;
}
