import { expect, it } from "vitest";
import { immigrationError, immigrationFilters, isOfficialTier, ruleTypeLabel } from "./domain";

it("allowlists filters", () => {
  expect(immigrationFilters({ country: "norway", type: "work_permit" })).toEqual({ country: "norway", type: "work_permit" });
  expect(immigrationFilters({ country: "atlantis", type: "golden_visa" })).toEqual({ country: "", type: "" });
});
it("treats only T1 as official", () => {
  expect(isOfficialTier("T1")).toBe(true);
  for (const tier of ["T2", "T3", "T4", null, undefined]) expect(isOfficialTier(tier)).toBe(false);
});
it("labels unknown rule types as Other and never leaks raw errors", () => {
  expect(ruleTypeLabel("post_study")).toBe("Post-study stay");
  expect(ruleTypeLabel("golden_visa")).toBe("Other");
  expect(immigrationError("immigration_requires_t1")).toContain("T1");
  expect(immigrationError("password=secret")).not.toContain("secret");
});
