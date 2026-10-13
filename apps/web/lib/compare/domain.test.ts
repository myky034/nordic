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
    { id: "a", fact_type_id: "m", country_id: "se", reference_period: "2023", status: "reviewed" },
    { id: "b", fact_type_id: "m", country_id: "se", reference_period: "2025-Q1", status: "conflicted" },
    { id: "c", fact_type_id: "m", country_id: "se", reference_period: null, status: "reviewed" },
    { id: "d", fact_type_id: "m", country_id: "dk", reference_period: "2024", status: "reviewed" },
    { id: "e", fact_type_id: null, country_id: "dk", reference_period: "2024", status: "reviewed" },
  ]);
  expect(cells.get("m:se")!.map((f) => f.id)).toEqual(["b", "a", "c"]);
  expect(cells.get("m:dk")!.map((f) => f.id)).toEqual(["d"]);
  expect(cells.size).toBe(2);
});
it("builds comparison URLs and hides raw errors", () => {
  expect(compareHref(["sweden", "denmark"], { category: "tuition", occupation: "" })).toBe("/compare?c=sweden&c=denmark&category=tuition");
  expect(metricError("postgres://secret")).not.toContain("secret");
});

it("formats a typed fact's structured value for the viewer without converting it (L3a)", async () => {
  const { formatStructuredValue, factTypeLabel, valueKindLabel, appliesToLabel } = await import("./domain");
  expect(formatStructuredValue({ value_number: "145000", value_currency: "SEK", value_period: "year" })).toBe("145.000 SEK / năm");
  expect(formatStructuredValue({ value_number: "145000", value_currency: "SEK", value_period: "year" }, "en")).toBe("145,000 SEK / year");
  expect(formatStructuredValue({ value_number: "6.5" })).toBe("6,5");
  expect(formatStructuredValue({ value_date: "2027-01-15" }, "en")).toBe("15/01/2027");
  expect(formatStructuredValue({ value_number: null })).toBeNull();
  expect(factTypeLabel({ label_vi: "Học phí", label_en: "Tuition" }, "en")).toBe("Tuition");
  expect(valueKindLabel("money")).toBe("Số tiền");
  expect(appliesToLabel("constructor")).toBe("constructor");
});
