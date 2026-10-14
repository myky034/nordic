import { expect, it } from "vitest";
import { norm, parseCandidates, precheck, structuredNotes } from "./validate";

const text = "Residence permit\nYou must have at least SEK 10,656 per month.\nRules apply from 1 January 2026.";
const base = { topic: "immigration", subject: "Residence permit", predicate: "maintenance", value: "SEK 10 656 per month", unit: null,
  excerpt: "You must have at least SEK 10,656 per month.", country: "sweden", valid_from: null, valid_until: null, reference_period: null,
  fact_type: null, value_number: null, value_currency: null, value_period: null, value_date: null };

it("normalises formatting only, the same way as the database", () => {
  expect(norm("  SEK 10,656 per\n month ")).toBe("sek 10656 per month");
  expect(norm("1.234.567")).toBe("1234567");
});
it("keeps only well-formed objects and turns empty strings into null", () => {
  const { candidates } = parseCandidates({ candidates: [{ ...base, unit: "", country: "", confidence: 0.8 }, "junk", null] });
  expect(candidates).toHaveLength(1);
  expect(candidates[0]).toMatchObject({ unit: null, country: null, confidence: 0.8 });
  expect(parseCandidates({ nope: [] }).candidates).toEqual([]);
  expect(parseCandidates({ candidates: Array.from({ length: 35 }, () => base) })).toMatchObject({ dropped: 5 });
});
it("refuses excerpts and numbers that are not in the page", () => {
  expect(precheck(base, text, ["sweden"])).toBeNull();
  expect(precheck({ ...base, excerpt: "You must have at least SEK 12,000 per month." }, text, ["sweden"])).toContain("not found verbatim");
  expect(precheck({ ...base, value: "SEK 12 000" }, text, ["sweden"])).toContain("Number 12000");
  expect(precheck({ ...base, valid_from: "2027-01-01" }, text, ["sweden"])).toContain("Number 2027");
  expect(precheck({ ...base, topic: "visa_guarantee" }, text, ["sweden"])).toContain("Topic");
  expect(precheck({ ...base, country: "atlantis" }, text, ["sweden"])).toContain("Unknown country");
});
// L4: a wrong type or structured value never refuses a grounded candidate;
// structuredNotes() predicts what the database would drop.
it("keeps a grounded typed candidate and lists what the database would drop", () => {
  const typed = { ...base, fact_type: "maintenance_requirement", value_number: "10656", value_currency: "SEK", value_period: "month" };
  const keys = ["maintenance_requirement"];
  expect(precheck(typed, text, ["sweden"])).toBeNull();
  expect(precheck({ ...typed, value_number: "12000" }, text, ["sweden"])).toBeNull();
  expect(structuredNotes(typed, keys)).toEqual([]);
  expect(structuredNotes({ ...typed, value_number: "10656.00" }, keys)).toEqual([]);
  expect(structuredNotes({ ...typed, value_number: "12000" }, keys)).toEqual(["Structured value dropped: 12000 is not in the excerpt"]);
  expect(structuredNotes({ ...typed, value_number: "10,656" }, keys)[0]).toContain("not digits");
  expect(structuredNotes(typed, [])).toEqual(['Fact type dropped: "maintenance_requirement" is not offered for this page', "Structured value dropped: no fact type"]);
  expect(structuredNotes({ ...typed, value_number: null, value_currency: null, value_period: null }, keys)).toEqual([]);
  expect(parseCandidates({ candidates: [{ ...typed, value_currency: "sek", value_date: "" }] }).candidates[0]).toMatchObject({ value_currency: "SEK", value_date: null });
});
