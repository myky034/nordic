import { describe, expect, it } from "vitest";
import { factBlockers, needsSourceVerification, programmeBlockers, ruleBlockers, visibilityOf } from "./visibility";

const verifiedT1 = { status: "verified", source_tier: "T1" };
const unverified = { status: "needs_verification", source_tier: "T1" };

describe("factBlockers mirrors facts_public", () => {
  it("does not require a verified source for a plain fact", () => {
    expect(factBlockers({ source: unverified })).toEqual([]);
  });
  it("explains every missing condition of an immigration-linked fact", () => {
    expect(factBlockers({ source: unverified, rule: { status: "proposed", source: { status: "needs_verification", source_tier: "T2" } } }))
      .toEqual(["rule_not_reviewed", "rule_source_unverified", "rule_source_not_t1", "source_unverified"]);
    expect(factBlockers({ source: verifiedT1, rule: { status: "reviewed", source: verifiedT1 } })).toEqual([]);
  });
  it("requires a reviewed occupation and a verified own source for a figure", () => {
    expect(factBlockers({ source: unverified, occupation: { status: "reviewed" } })).toEqual(["source_unverified"]);
    expect(factBlockers({ source: verifiedT1, occupation: { status: "proposed" } })).toEqual(["occupation_not_reviewed"]);
  });
});

describe("rule and programme blockers", () => {
  it("needs a verified T1 source for an immigration rule", () => {
    expect(ruleBlockers({ source: verifiedT1 })).toEqual([]);
    expect(ruleBlockers({ source: { status: "verified", source_tier: null } })).toEqual(["rule_source_not_t1"]);
  });
  it("needs the university reviewed for a programme", () => {
    expect(programmeBlockers({ universityStatus: "reviewed" })).toEqual([]);
    expect(programmeBlockers({ universityStatus: undefined })).toEqual(["university_not_reviewed"]);
  });
  it("points to the Source Registry only for source problems", () => {
    expect(needsSourceVerification(["rule_source_unverified"])).toBe(true);
    expect(needsSourceVerification(["occupation_not_reviewed", "university_not_reviewed"])).toBe(false);
  });
});

describe("visibilityOf", () => {
  it("previews what a proposal needs, and never calls a proposal public", () => {
    expect(visibilityOf("a", "proposed", null, [])).toEqual({ state: "will_be_public" });
    expect(visibilityOf("a", "proposed", new Set(["a"]), ["source_unverified"])).toEqual({ state: "will_stay_hidden", blockers: ["source_unverified"] });
  });
  it("takes the public answer from the database, not from the status", () => {
    expect(visibilityOf("a", "reviewed", new Set(["a"]), ["source_unverified"])).toEqual({ state: "public" });
    expect(visibilityOf("a", "conflicted", new Set(), [])).toEqual({ state: "hidden", blockers: [] });
  });
  it("reports a failed check as unknown, never as public", () => {
    expect(visibilityOf("a", "reviewed", null, [])).toEqual({ state: "unknown" });
  });
  it("has nothing to say about rejected records", () => {
    expect(visibilityOf("a", "rejected", new Set(["a"]), [])).toBeNull();
  });
});
