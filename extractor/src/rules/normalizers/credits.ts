import { EMPTY_VALUE, fail, numberText, parseDecimal, type NormalizeResult } from "./result";

// Credits as the source states them (fact type programme_credits).
// The unit is kept exactly as written, grouped into three labels:
// "ECTS" (ECTS / ECTS credits), "hp" (högskolepoäng) and "credits" (no
// system named). Nothing is converted: Swedish hp → ECTS, or "credits" →
// ECTS, would need an approved, documented rule (D7).

const CREDITS = /\b(\d+(?:[.,]\d+)?)\s*(ects[\s-]*credits?|ects|högskolepoäng|hp|credit\s+points|credits?)(?![\p{L}])/giu;
const MULTIPLIED = /\d\s*[x×]\s*$/i;

const unitLabel = (word: string) => {
  const w = word.toLowerCase();
  if (w.startsWith("ects")) return "ECTS";
  if (w === "hp" || w === "högskolepoäng") return "hp";
  return "credits";
};

export function normalizeCredits(text: string): NormalizeResult {
  const found: { text: string; number: string; unit: string }[] = [];
  for (const m of text.matchAll(CREDITS)) {
    // "2 x 7.5 credits" lists courses; the product is not computed.
    if (MULTIPLIED.test(text.slice(0, m.index))) return fail(text, "multiplied", `"${m[0]}" is multiplied by a count; the total is not computed`);
    found.push({ text: m[0], number: numberText(parseDecimal(m[1])), unit: unitLabel(m[2]) });
  }
  if (!found.length) return fail(text, "no_value", "No credits stated");
  const distinct = [...new Set(found.map((f) => `${f.number} ${f.unit}`))];
  if (distinct.length > 1) return fail(text, "several_values", `Several credit values: ${distinct.join(", ")}`);
  const first = found[0];
  return {
    raw: { text, unit: first.unit },
    readings: [{ status: "ok", text: first.text, value: { ...EMPTY_VALUE, number: first.number, unit: first.unit }, notes: [] }],
    failure: null,
  };
}
