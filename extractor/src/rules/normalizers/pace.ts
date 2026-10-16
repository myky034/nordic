import { EMPTY_VALUE, fail, numberText, parseDecimal, type NormalizeResult } from "./result";

// Study pace as a percentage (fact type study_pace_percent, D8). Only a
// stated percentage is read ("Day-time, 50%"). Words such as "half-time" or
// "part-time" are not turned into a number: what they mean is a national or
// university convention, which needs an approved rule first (D7).

const PERCENT = /(?<![\d.,])(\d{1,3}(?:[.,]\d+)?)\s*%/g;
const WORDS = /\b(?:half|full|part|quarter)[\s-]?time\b/i;

export function normalizePace(text: string): NormalizeResult {
  const found = [...text.matchAll(PERCENT)].map((m) => ({ text: m[0], value: parseDecimal(m[1]) }));
  if (!found.length) {
    return WORDS.test(text) ? fail(text, "words_not_converted", "Pace in words is not converted to a percentage without an approved rule")
      : fail(text, "no_value", "No percentage");
  }
  const distinct = [...new Set(found.map((f) => f.value))];
  if (distinct.length > 1) return fail(text, "several_values", `Several percentages: ${found.map((f) => f.text).join(", ")}`);
  const first = found[0];
  if (!(first.value > 0 && first.value <= 100)) return fail(text, "out_of_range", `${first.text} is not a study pace`);
  return {
    raw: { text, unit: "%" },
    readings: [{ status: "ok", text: first.text, value: { ...EMPTY_VALUE, number: numberText(first.value), unit: "percent" }, notes: [] }],
    failure: null,
  };
}
