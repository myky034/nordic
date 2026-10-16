import type { ValuePeriod } from "@nordic/db/rule-output";
import { EMPTY_VALUE, fail, type NormalizeResult, type Reading } from "./result";

// Amounts of money (fact types tuition_fee, application_fee, …).
// The database stores a structured amount only when number, currency AND
// period are all known (CHECK facts_money_complete), so an amount whose
// period or currency the source does not state is "unresolved", not "ok".
// One text can hold several amounts ("First instalment: 67500 SEK. The
// complete course: 135000 SEK"): each becomes its own reading. Amounts are
// never added, divided or attributed to an applicant group here (D2, Risk C).

const CODES = ["SEK", "EUR", "NOK", "DKK", "ISK", "USD", "GBP", "CHF"] as const;
const SYMBOLS: Record<string, string> = { "€": "EUR", "£": "GBP" };
// Signs that name several currencies; reported, never guessed.
const AMBIGUOUS = ["$", "kr", "kr.", "kronor", "krona"];

const AMOUNT = String.raw`\d{1,3}(?:[   ,.]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const SIGN = String.raw`[A-Z]{3}|€|£|\$|kronor|krona|kr\.?`;
// Left and right boundaries keep "kr" or "SEK" inside a word, and digits of a
// longer number, out of a match.
const MONEY = new RegExp(String.raw`(?<![\p{L}\d.,])(?:(${SIGN})\s?(${AMOUNT})|(${AMOUNT})\s?(${SIGN}))(?![\p{L}\d])`, "gu");

// Generic period phrases; a rule may add site wording through `periods`.
const PERIOD_PHRASES: [ValuePeriod, RegExp][] = [
  ["semester", /\b(?:per|each|every|a)\s+(?:semester|term)\b|\/\s*(?:semester|term)\b/i],
  ["year", /\b(?:per|each|every|a)\s+(?:academic\s+)?year\b|\bannual(?:ly)?\b|\byearly\b|\/\s*year\b/i],
  ["month", /\b(?:per|each|every|a)\s+month\b|\bmonthly\b|\/\s*month\b/i],
  ["week", /\b(?:per|each|every|a)\s+week\b|\bweekly\b|\/\s*week\b/i],
  ["total", /\b(?:in\s+)?total\b|\b(?:complete|entire|full|whole)\s+(?:course|programme|program|education)\b/i],
  ["one_off", /\bone[\s-](?:off|time)\b/i],
];

/** "135 000" / "135,000" / "1.234,50" → "135000" / "135000" / "1234.50". */
function amountText(s: string) {
  const decimal = /[.,](\d{1,2})$/.exec(s);
  const whole = (decimal ? s.slice(0, decimal.index) : s).replace(/[   ,.]/g, "");
  return decimal ? `${whole}.${decimal[1]}` : whole;
}

export type MoneyOptions = {
  /** Site wording → period, from a reviewed rule (e.g. { "per academic year": "year" }). Matched case-insensitively. */
  periods?: Readonly<Record<string, ValuePeriod>>;
};

export function normalizeMoney(text: string, options: MoneyOptions = {}): NormalizeResult {
  // Three capitals count as a currency only when they are a known code ("EEA 2026" is not money).
  const matches = [...text.matchAll(MONEY)].filter((m) => {
    const sign = m[1] ?? m[4];
    return !/^[A-Z]{3}$/.test(sign) || (CODES as readonly string[]).includes(sign);
  });
  if (!matches.length) return fail(text, "no_value", "No amount with a currency");
  // Sentence ends: . ; ! ? followed by white space, or a line break ("1.234,50" has no space after the dot).
  const boundaries = [...text.matchAll(/[.;!?](?=\s)|\n/g)].map((b) => (b.index ?? 0) + 1);
  const readings: Reading[] = matches.map((m, i) => {
    const sign = m[1] ?? m[4];
    const amount = m[2] ?? m[3];
    // The clause an amount belongs to: its sentence, cut at the neighbouring
    // amounts, so "The complete course" never describes the amount before it.
    const at = m.index ?? 0, after = at + m[0].length;
    const prevEnd = i === 0 ? 0 : (matches[i - 1].index ?? 0) + matches[i - 1][0].length;
    const nextStart = i === matches.length - 1 ? text.length : matches[i + 1].index ?? text.length;
    const start = Math.max(prevEnd, ...boundaries.filter((b) => b <= at));
    const end = Math.min(nextStart, ...boundaries.filter((b) => b >= after));
    const clause = text.slice(start, end);
    if (AMBIGUOUS.includes(sign.toLowerCase()) || sign === "$") {
      return { status: "unresolved", text: m[0], reason: { code: "currency_ambiguous", detail: `"${sign}" names several currencies` }, notes: [] };
    }
    const currency = SYMBOLS[sign] ?? sign;
    const lower = clause.toLowerCase();
    const fromRule = Object.entries(options.periods ?? {}).filter(([phrase]) => lower.includes(phrase.toLowerCase())).map(([, p]) => p);
    const periods = [...new Set(fromRule.length ? fromRule : PERIOD_PHRASES.filter(([, re]) => re.test(clause)).map(([p]) => p))];
    if (periods.length !== 1) {
      return { status: "unresolved", text: m[0],
        reason: periods.length ? { code: "period_ambiguous", detail: `Several periods: ${periods.join(", ")}` } : { code: "period_unknown", detail: "The source does not say what the amount covers" },
        notes: [] };
    }
    return { status: "ok", text: m[0], value: { ...EMPTY_VALUE, number: amountText(amount), currency, period: periods[0] }, notes: [] };
  });
  return { raw: { text, unit: null }, readings, failure: null };
}
