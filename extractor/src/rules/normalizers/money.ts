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

// Thousands may be grouped by a space, a no-break space (U+00A0), a narrow
// no-break space (U+202F), a comma or a dot.
const SPACES = String.raw`\u0020\u00a0\u202f`;
const AMOUNT = String.raw`\d{1,3}(?:[${SPACES},.]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const SIGN = String.raw`[A-Z]{3}|€|£|\$|kronor|krona|kr\.?`;
// Left and right boundaries keep "kr" or "SEK" inside a word, and digits of a
// longer number, out of a match.
const MONEY = new RegExp(String.raw`(?<![\p{L}\d.,])(?:(${SIGN})\s?(${AMOUNT})|(${AMOUNT})\s?(${SIGN}))(?![\p{L}\d])`, "gu");
const SPACE_GROUP = new RegExp(String.raw`^(\d{1,3})[${SPACES}](\d{3})`, "u");

// Which period an amount covers (PR #6 review M3). A phrase qualifies an
// amount only inside that amount's own part of the sentence: the words after
// it up to the next clause break or amount, and the words before it back to
// the previous clause break or amount. Breaks: sentence ends , ; ( ) and the
// joining words "and", "or", "but", "while", "whereas", "plus", "of which".
// So in "100000 SEK, of which a total of 20000 SEK …" neither amount is a
// total, and in "30000 SEK per semester, total 120000 SEK" each gets its own.
const BREAK = /[,;()]|[.!?](?=\s)|\n|\s(?:and|or|but|while|whereas|plus|of which)\s/gi;
const PERIOD_WORD: Record<string, ValuePeriod> = { year: "year", semester: "semester", term: "semester", month: "month", week: "week" };
// "a year" / "/ year" counts only right after the amount ("£12,000 a year"),
// never in descriptive text ("students who spend a year in Sweden").
const ADJACENT = /^\s*(?:a|\/)\s*(year|semester|term|month|week)\b/i;
// Explicit wording, before or after the amount.
const PERIOD_PHRASES: [ValuePeriod, RegExp][] = [
  ["semester", /\b(?:per|each|every)\s+(?:semester|term)\b|\/\s*(?:semester|term)\b/i],
  ["year", /\b(?:per|each|every)\s+(?:academic\s+)?year\b|\bannual(?:ly)?\b|\byearly\b|\/\s*year\b/i],
  ["month", /\b(?:per|each|every)\s+month\b|\bmonthly\b|\/\s*month\b/i],
  ["week", /\b(?:per|each|every)\s+week\b|\bweekly\b|\/\s*week\b/i],
  // "total" but not "a total of" (a sum of something, not the programme total).
  ["total", /\bin\s+total\b|\btotal\b(?!\s+of\b)|\b(?:complete|entire|full|whole)\s+(?:course|programme|program|education)\b/i],
  ["one_off", /\bone[\s-](?:off|time)\b/i],
];

/** The words that may qualify the amount at [at, after): its own part of the sentence. */
function ownWords(text: string, at: number, after: number, prevEnd: number, nextStart: number) {
  const breaks = [...text.matchAll(BREAK)].map((b) => [b.index ?? 0, (b.index ?? 0) + b[0].length] as const);
  const start = Math.max(prevEnd, ...breaks.filter(([, e]) => e <= at).map(([, e]) => e));
  // A parenthesis right after the amount belongs to it: "900 SEK (one-off)".
  const rest = text.slice(after, nextStart);
  const paren = /^\s*\(([^()]*)\)/.exec(rest);
  const from = paren ? after + paren[0].length : after;
  const end = Math.min(nextStart, ...breaks.filter(([b]) => b >= from).map(([b]) => b));
  return { before: text.slice(start, at), after: text.slice(after, Math.max(end, from)) };
}

/** "135 000" / "135,000" / "1.234,50" → "135000" / "135000" / "1234.50". */
function amountText(s: string) {
  const decimal = /[.,](\d{1,2})$/.exec(s);
  const whole = (decimal ? s.slice(0, decimal.index) : s).replace(/[\u0020\u00a0\u202f,.]/gu, "");
  return decimal ? `${whole}.${decimal[1]}` : whole;
}

/**
 * M1 (PR #5 review): "Year 1 135 000 SEK" may be "Year 1" + "135 000 SEK"
 * or a label + "1 135 000 SEK". Space-grouped digits cannot tell these apart,
 * so the amount is unresolved when ALL of these hold:
 * - the first group is separated by a space-like character;
 * - the rest without the first group is itself a plausible amount (it does
 *   not start with 0: "135 000" minus "135" leaves "000", which is not);
 * - a word or a number stands right before it (only spaces between), so the
 *   first group could belong to that word. A currency sign before the amount
 *   ("SEK 1 135 000"), the start of the text, or punctuation ("Total: 1 135 000")
 *   settle the boundary.
 */
function boundaryAmbiguous(text: string, amountStart: number, amount: string, signFirst: boolean) {
  if (signFirst) return false;
  const group = SPACE_GROUP.exec(amount);
  if (!group || group[2].startsWith("0")) return false;
  return /[\p{L}\d]\s+$/u.test(text.slice(0, amountStart));
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
  const readings: Reading[] = matches.map((m, i) => {
    const signFirst = m[1] !== undefined;
    const sign = m[1] ?? m[4];
    const amount = m[2] ?? m[3];
    const at = m.index ?? 0, after = at + m[0].length;
    if (boundaryAmbiguous(text, signFirst ? at + m[0].indexOf(amount) : at, amount, signFirst)) {
      return { status: "unresolved", text: m[0],
        reason: { code: "amount_boundary_ambiguous", detail: `"${m[0]}" may include a number that belongs to the words before it` }, notes: [] };
    }
    if (AMBIGUOUS.includes(sign.toLowerCase()) || sign === "$") {
      return { status: "unresolved", text: m[0], reason: { code: "currency_ambiguous", detail: `"${sign}" names several currencies` }, notes: [] };
    }
    const prevEnd = i === 0 ? 0 : (matches[i - 1].index ?? 0) + matches[i - 1][0].length;
    const nextStart = i === matches.length - 1 ? text.length : matches[i + 1].index ?? text.length;
    const words = ownWords(text, at, after, prevEnd, nextStart);
    const own = `${words.before} ${words.after}`;
    const currency = SYMBOLS[sign] ?? sign;
    const lower = own.toLowerCase();
    const fromRule = Object.entries(options.periods ?? {}).filter(([phrase]) => lower.includes(phrase.toLowerCase())).map(([, p]) => p);
    const adjacent = ADJACENT.exec(words.after);
    const generic = [...PERIOD_PHRASES.filter(([, re]) => re.test(own)).map(([p]) => p), ...(adjacent ? [PERIOD_WORD[adjacent[1].toLowerCase()]] : [])];
    const periods = [...new Set(fromRule.length ? fromRule : generic)];
    if (periods.length !== 1) {
      return { status: "unresolved", text: m[0],
        reason: periods.length ? { code: "period_ambiguous", detail: `Several periods: ${periods.join(", ")}` } : { code: "period_unknown", detail: "The source does not say what the amount covers" },
        notes: [] };
    }
    return { status: "ok", text: m[0], value: { ...EMPTY_VALUE, number: amountText(amount), currency, period: periods[0] }, notes: [] };
  });
  return { raw: { text, unit: null }, readings, failure: null };
}
