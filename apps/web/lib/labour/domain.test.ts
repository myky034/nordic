import { expect, it } from "vitest";
import { classificationLabel, isOfficialStatisticsTier, isReferencePeriod, labourError } from "./domain";

it("accepts only explicit reference periods", () => {
  for (const ok of ["2024", "2025-Q2", "2024-H1", "2024-09"]) expect(isReferencePeriod(ok)).toBe(true);
  for (const bad of ["recent", "2024-Q5", "24", "2024-13", "2024-1", "2024 "]) expect(isReferencePeriod(bad)).toBe(false);
});
it("treats T1/T2 as official statistics and labels the rest", () => {
  expect(isOfficialStatisticsTier("T1")).toBe(true);
  expect(isOfficialStatisticsTier("T2")).toBe(true);
  for (const t of ["T3", "T4", null]) expect(isOfficialStatisticsTier(t)).toBe(false);
});
it("never invents a classification code or leaks raw errors", () => {
  expect(classificationLabel(null, null)).toContain("No classification");
  expect(classificationLabel("ISCO-08", "2512")).toBe("ISCO-08 2512");
  expect(labourError("postgres://secret")).not.toContain("secret");
});
