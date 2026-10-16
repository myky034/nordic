import { COUNT, EMPTY_VALUE, countValue, fail, numberText, type NormalizeResult } from "./result";

// Duration of study as months (fact type programme_duration, unit hint months).
// Approved conversions only (review §5.5, D7): years → months (×12) and
// months as stated. Everything else is reported, not computed:
// - "One Year Master's Programme" is a degree NAME, not a duration;
// - "31/08/2026 - 04/06/2028" is an intake schedule, not a duration
//   (the SU fact found on 2026-10-16 was exactly this mistake);
// - semesters are not converted (their length is not stated);
// - credits and study pace are never used to compute a duration.

const DURATION = new RegExp(String.raw`\b${COUNT}[\s-]*(years?|yrs?|months?)\b`, "gi");
const SEMESTERS = new RegExp(String.raw`\b${COUNT}[\s-]*semesters?\b`, "i");
const DEGREE_AFTER = /^[\s-]*(master|master['’]s|masters|bachelor|bachelor['’]s|bachelors|magister|licentiate|msc|mba|ma|ba|bsc)\b/i;
const NUMERIC_DATE = /\b\d{1,2}[/.]\d{1,2}[/.]\d{4}\b/g;

export function normalizeDuration(text: string): NormalizeResult {
  const found: { text: string; months: number; unit: string }[] = [];
  let degreeName: string | null = null;
  for (const m of text.matchAll(DURATION)) {
    const after = text.slice((m.index ?? 0) + m[0].length);
    if (DEGREE_AFTER.test(after)) { degreeName = m[0]; continue; }
    const unit = m[2].toLowerCase().startsWith("m") ? "months" : "years";
    const n = countValue(m[1]);
    found.push({ text: m[0], months: unit === "years" ? n * 12 : n, unit });
  }
  if (!found.length) {
    if (degreeName) return fail(text, "degree_name", `"${degreeName}" is part of a degree name, not a stated duration`);
    if ((text.match(NUMERIC_DATE) ?? []).length >= 2) return fail(text, "schedule_not_duration", "Start and end dates are a schedule; the duration is not computed from them");
    if (SEMESTERS.test(text)) return fail(text, "semesters_not_converted", "Semesters are not converted to months without an approved rule");
    return fail(text, "no_value", "No duration in years or months");
  }
  const distinct = [...new Set(found.map((f) => f.months))];
  if (distinct.length > 1) return fail(text, "several_values", `Several durations: ${found.map((f) => f.text).join(", ")}`);
  const first = found[0];
  const notes = first.unit === "years" ? [`${first.text} → ${numberText(first.months)} months (12 months per year)`] : [];
  return {
    raw: { text, unit: first.unit },
    readings: [{ status: "ok", text: first.text, value: { ...EMPTY_VALUE, number: numberText(first.months), unit: "months" }, notes }],
    failure: null,
  };
}
