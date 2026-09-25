import { expect, it } from "vitest";
import { buildCells, categoryParam, compareCountries, compareHref, metricError, metricKeyPattern } from "./domain";

it("parses 2–5 allowlisted countries in a stable order", () => {
  expect(compareCountries({ c: ["norway", "Sweden", "sweden", "atlantis"] })).toEqual({ countries: ["sweden", "norway"], ready: true });
  expect(compareCountries({ c: "denmark" })).toEqual({ countries: ["denmark"], ready: false });
  expect(compareCountries({}).ready).toBe(false);
  expect(compareCountries({ c: ["sweden", "denmark", "finland", "norway", "netherlands"] }).countries).toHaveLength(5);
});
it("accepts only known categories and well-formed metric keys", () => {
  expect(categoryParam({ category: "tuition" })).toBe("tuition");
  expect(categoryParam({ category: "happiness" })).toBe("");
  expect(metricKeyPattern.test("living_cost_student")).toBe(true);
  for (const bad of ["Living", "1abc", "a", "has space", "x".repeat(61)]) expect(metricKeyPattern.test(bad)).toBe(false);
});
it("keeps every value per cell, newest period first, and never merges cells", () => {
  const cells = buildCells([
    { id: "a", metric_id: "m", country_id: "se", reference_period: "2023", status: "reviewed" },
    { id: "b", metric_id: "m", country_id: "se", reference_period: "2025-Q1", status: "conflicted" },
    { id: "c", metric_id: "m", country_id: "se", reference_period: null, status: "reviewed" },
    { id: "d", metric_id: "m", country_id: "dk", reference_period: "2024", status: "reviewed" },
    { id: "e", metric_id: null, country_id: "dk", reference_period: "2024", status: "reviewed" },
  ]);
  expect(cells.get("m:se")!.map((f) => f.id)).toEqual(["b", "a", "c"]);
  expect(cells.get("m:dk")!.map((f) => f.id)).toEqual(["d"]);
  expect(cells.size).toBe(2);
});
it("builds comparison URLs and hides raw errors", () => {
  expect(compareHref(["sweden", "denmark"], { category: "tuition", occupation: "" })).toBe("/compare?c=sweden&c=denmark&category=tuition");
  expect(metricError("postgres://secret")).not.toContain("secret");
});
