import { expect, it } from "vitest";
import { norm, parseCandidates, precheck } from "./validate";

const text = "Residence permit\nYou must have at least SEK 10,656 per month.\nRules apply from 1 January 2026.";
const base = { topic: "immigration", subject: "Residence permit", predicate: "maintenance", value: "SEK 10 656 per month", unit: null,
  excerpt: "You must have at least SEK 10,656 per month.", country: "sweden", valid_from: null, valid_until: null, reference_period: null };

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
