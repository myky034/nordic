import type { NormalizedValue } from "@nordic/db/rule-output";

// PR 2a (review §5.5): what every normalizer returns. Three outcomes are kept
// apart on purpose, because "missing" must never look like "zero" or "free":
// - a reading with status "ok": a value the database can store as-is;
// - a reading with status "unresolved": the text was understood but a part
//   the source did not state is missing (a year, a fee period), so no
//   structured value is produced and the text stays as written;
// - `failure`: nothing could be read, or the text as a whole cannot be read
//   safely (several different values, a degree name instead of a duration).
// Normalizers are pure: same text and options, same result.

export type ReasonCode =
  | "no_value" | "several_values" | "degree_name" | "schedule_not_duration" | "semesters_not_converted"
  | "multiplied" | "currency_ambiguous" | "currency_missing" | "period_unknown" | "period_ambiguous"
  | "year_missing" | "date_order_ambiguous" | "invalid_date" | "words_not_converted" | "out_of_range";

export type Reason = { code: ReasonCode; detail: string };

/** The source text a reading came from, verbatim, and the unit word as written there. */
export type Raw = { text: string; unit: string | null };

export type Reading =
  | { status: "ok"; text: string; value: NormalizedValue; notes: string[] }
  | { status: "unresolved"; text: string; reason: Reason; notes: string[] };

export type NormalizeResult = { raw: Raw; readings: Reading[]; failure: Reason | null };

export const EMPTY_VALUE: NormalizedValue = { number: null, currency: null, period: null, date: null, unit: null };

export const fail = (text: string, code: ReasonCode, detail: string): NormalizeResult =>
  ({ raw: { text, unit: null }, readings: [], failure: { code, detail } });

/**
 * "1,5" or "1.5" → 1.5. Only for short numbers (counts of years, credits,
 * percentages), where a separator followed by digits is a decimal mark.
 */
export const parseDecimal = (s: string) => Number(s.replace(",", "."));

/** Number → string without floating-point noise (1.5 * 12 → "18", 0.1 + 0.2 → "0.3"). */
export const numberText = (n: number) => String(Number(n.toFixed(4)));

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
/** A digit string or an English number word from one to ten. */
export const countValue = (s: string) => WORD_NUMBERS[s.toLowerCase()] ?? parseDecimal(s);
export const COUNT = String.raw`(\d+(?:[.,]\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)`;
