import { describe, expect, it } from "vitest";
import { VALUE_PERIODS as DB_PERIODS, type IntakeRef } from "@nordic/db/rule-output";
import { VALUE_PERIODS as PROMPT_PERIODS } from "../prompt";
import { validateRules } from "./config";
import { checkVersions, compareCodeUnits, ruleFingerprint, rulesetVersion } from "./fingerprint";
import { RULES, VERSIONS } from "./registry";
import type { Rule } from "./types";

// PR 2a (review §5.3): rule definitions are checked before use, and a
// changed definition must carry a new version. Example rules are synthetic.

const base: Rule = {
  id: "example.tuition.pair", version: 1, enabled: true, mode: "shadow", priority: 0,
  scope: { country: "sweden", source: "https://uni.example.test", pageType: "programme_intake" },
  field: "tuition_fee", strategy: { kind: "pair", labels: ["Tuition fee"] },
  normalize: { kind: "money" }, intake: { from: "none" }, evidence: "value",
};
const deadlines: Rule = {
  id: "example.deadline.section", version: 1, enabled: true, mode: "shadow", priority: 0,
  scope: { source: "https://uni.example.test" }, field: "application_deadline",
  strategy: { kind: "section_lines", heading: /^Application deadlines for studies starting (\w+) (\d{4})$/, line: /^(.+?): (.+)$/ },
  normalize: { kind: "date" }, intake: { from: "heading", pattern: /^Application deadlines for studies starting (?<month>\w+) (?<year>\d{4})$/ }, evidence: "text",
};
const check = (...rules: Rule[]) => validateRules(rules);

describe("rule validation", () => {
  it("accepts well-formed rules", () => {
    expect(check(base, deadlines)).toEqual([]);
  });
  it.each<[string, Partial<Rule>, RegExp]>([
    ["bad id", { id: "Tuition Fee" }, /id must be dotted/],
    ["version 0", { version: 0 }, /version must be a whole number/],
    ["unknown field", { field: "invented_fee" }, /not a known fact type/],
    ["retired field", { field: "programme_duration_text" }, /not a known fact type/],
    ["normalizer for another kind", { normalize: { kind: "duration" } }, /does not suit a money fact type/],
    ["unknown mode", { mode: "live" as Rule["mode"] }, /mode must be/],
    ["source with a path", { scope: { source: "https://uni.example.test/education" } }, /https origin without a path/],
    ["page without source", { scope: { page: /^https:\/\/x\.test\/a$/ } }, /scope.page needs scope.source/],
    ["page not anchored", { scope: { source: "https://uni.example.test", page: /programme/ } }, /must be anchored/],
    ["empty labels", { strategy: { kind: "pair", labels: [" "] } }, /non-empty labels/],
    ["pair with text evidence", { evidence: "text" }, /evidence "label", "value" or "canonical"/],
  ])("rejects %s", (_name, change, problem) => {
    expect(check({ ...base, ...change }).join("\n")).toMatch(problem);
  });
  it("rejects stateful or unanchored patterns", () => {
    const g = { ...deadlines, strategy: { kind: "section_lines" as const, heading: /^A (\d{4})$/g, line: /^(.+)$/ } };
    expect(check(g).join("\n")).toMatch(/flags g and y are not allowed/);
    const loose = { ...deadlines, strategy: { kind: "section_lines" as const, heading: /Application deadlines/, line: /^(.+)$/ } };
    expect(check(loose).join("\n")).toMatch(/section_lines.heading: must be anchored/);
  });
  it("never lets a URL decide the intake, and needs the year from a heading", () => {
    expect(check({ ...base, intake: { from: "url" } as unknown as Rule["intake"] }).join("\n")).toMatch(/a URL alone never decides an intake/);
    expect(check({ ...deadlines, intake: { from: "heading", pattern: /^Autumn \d{4}$/ } }).join("\n")).toMatch(/capture the year/);
    expect(check({ ...deadlines, intake: { from: "heading", pattern: /^Intake (?<year>\d{4})$/ } }).join("\n")).toMatch(/a year alone is not an intake/);
  });
  it("only intake-specific fact types may take an intake from a heading or the page (D2, Risk C)", () => {
    expect(check({ ...base, intake: { from: "page" } }).join("\n")).toMatch(/"tuition_fee" is not intake-specific/);
    expect(check({ ...base, field: "teaching_language", normalize: { kind: "text" }, intake: { from: "heading", pattern: /^Autumn (?<year>\d{4})$/ } }).join("\n"))
      .toMatch(/"teaching_language" is not intake-specific/);
    expect(check({ ...deadlines, intake: { from: "page" } })).toEqual([]);
  });
  it("checks overrides and collisions across rules", () => {
    expect(check({ ...base, overrides: ["missing.rule"] }).join("\n")).toMatch(/overrides unknown rule/);
    expect(check(base, { ...deadlines, id: "example.deadline.other", overrides: [base.id] }).join("\n")).toMatch(/targets another field/);
    expect(check(base, { ...base, id: "example.tuition.again" }).join("\n")).toMatch(/same field, scope and priority/);
    expect(check(base, { ...base, id: "example.tuition.again", priority: 1 })).toEqual([]);
  });
});

describe("versions", () => {
  const lock = { [base.id]: { version: 1, fingerprint: ruleFingerprint(base) } };
  it("passes when every rule is recorded", () => {
    expect(checkVersions([base], lock)).toEqual([]);
  });
  it("fails when a definition changes without a new version", () => {
    expect(checkVersions([{ ...base, strategy: { kind: "pair", labels: ["Tuition"] } }], lock).join("\n")).toMatch(/definition changed but version is still 1/);
  });
  it("fails until the record follows a new version, and for unknown or missing records", () => {
    expect(checkVersions([{ ...base, version: 2 }], lock).join("\n")).toMatch(/differs from versions.ts/);
    expect(checkVersions([deadlines], lock).join("\n")).toMatch(/not recorded in versions.ts[\s\S]*not in the registry/);
  });
  it("fingerprints ignore key order and version, but not patterns", () => {
    const reordered = Object.fromEntries(Object.entries(base).reverse()) as Rule;
    expect(ruleFingerprint(reordered)).toBe(ruleFingerprint(base));
    expect(ruleFingerprint({ ...base, version: 7 })).toBe(ruleFingerprint(base));
    const other = { ...deadlines, strategy: { ...deadlines.strategy, line: /^(.+?) - (.+)$/ } } as Rule;
    expect(ruleFingerprint(other)).not.toBe(ruleFingerprint(deadlines));
  });
  describe("M3: rollout state is not part of the definition (PR #5 review)", () => {
    it("mode and enabled do not change the fingerprint, so promotion keeps id + version", () => {
      expect(ruleFingerprint({ ...base, mode: "propose" })).toBe(ruleFingerprint(base));
      expect(ruleFingerprint({ ...base, enabled: false })).toBe(ruleFingerprint(base));
      expect(checkVersions([{ ...base, mode: "propose" }], lock)).toEqual([]);
    });
    it.each<[string, Partial<Rule>]>([
      ["scope", { scope: { source: "https://uni.example.test" } }],
      ["field", { field: "application_fee" }],
      ["strategy", { strategy: { kind: "pair", labels: ["Fees"] } }],
      ["normalize", { normalize: { kind: "money", periods: { "first instalment": "one_off" } } }],
      ["intake", { intake: { from: "page" } }],
      ["evidence", { evidence: "canonical" }],
      ["priority", { priority: 5 }],
      ["overrides", { overrides: ["example.other"] }],
    ])("a change of %s changes the fingerprint and needs a new version", (_what, change) => {
      const changed = { ...base, ...change } as Rule;
      expect(ruleFingerprint(changed)).not.toBe(ruleFingerprint(base));
      expect(checkVersions([changed], lock).join("\n")).toMatch(/definition changed but version is still 1/);
    });
  });
  describe("M4: order by code units, not the machine's locale (PR #5 review)", () => {
    const ids = ["su.a_b", "su.a-b", "su.a.c", "su.aa", "su.B"];
    it("sorts ids by UTF-16 code units", () => {
      expect([...ids].sort(compareCodeUnits)).toEqual(["su.B", "su.a-b", "su.a.c", "su.a_b", "su.aa"]);
    });
    it("gives the same rule set version for every registry order", () => {
      const rules = ids.map((id) => ({ ...base, id, field: "tuition_fee", priority: ids.indexOf(id) }) as Rule);
      const expected = rulesetVersion(rules);
      for (const order of [[...rules].reverse(), [rules[2], rules[0], rules[4], rules[1], rules[3]], [rules[1], rules[0], ...rules.slice(2)]]) {
        expect(rulesetVersion(order)).toBe(expected);
      }
    });
  });
  it("names a rule set independently of order", () => {
    expect(rulesetVersion([base, deadlines])).toBe(rulesetVersion([deadlines, base]));
    expect(rulesetVersion([base])).not.toBe(rulesetVersion([base, deadlines]));
  });
});

describe("registry and shared contract", () => {
  it("the registry is valid and fully versioned (empty until PR 2b)", () => {
    expect(validateRules(RULES)).toEqual([]);
    expect(checkVersions(RULES, VERSIONS)).toEqual([]);
  });
  it("fee periods are the same in the contract, the prompt and the database CHECK", () => {
    expect([...DB_PERIODS]).toEqual([...PROMPT_PERIODS]);
  });
  it("an intake reference cannot come from a URL", () => {
    // @ts-expect-error: "url" is not a valid source of an intake (review §1.5).
    const fromUrl: IntakeRef["from"] = "url";
    expect(fromUrl).toBe("url");
  });
});
