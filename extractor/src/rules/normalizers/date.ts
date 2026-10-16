import { EMPTY_VALUE, fail, type NormalizeResult } from "./result";

// One calendar date (fact types application_deadline, intake_start_date, …).
// D6: a date without a stated year ("15 January") stays text: the reading
// is "unresolved" and no year is guessed, even when a heading nearby names
// a year. "31/08/2026" is read day-first because 31 cannot be a month; a
// numeric date where both orders are possible ("04/06/2028") needs the
// order from a reviewed rule (`order`). Several dates in one text (a
// schedule "31/08/2026 - 04/06/2028") are not split here.

const MONTHS: Record<string, number> = {};
[
  ["january", "jan", "januari"], ["february", "feb", "februari"], ["march", "mar", "mars"], ["april", "apr"],
  ["may", "maj"], ["june", "jun", "juni"], ["july", "jul", "juli"], ["august", "aug", "augusti"],
  ["september", "sep", "sept"], ["october", "oct", "oktober", "okt"], ["november", "nov"], ["december", "dec"],
].forEach((names, i) => names.forEach((n) => (MONTHS[n] = i + 1)));
const MONTH = `(${Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|")})`;
const YEAR = String.raw`(?:,?\s*\(?(\d{4})\)?)?`;

const PATTERNS: { re: RegExp; read: (m: RegExpMatchArray) => { day: number; month: number; year: number | null } | "ambiguous" }[] = [
  { re: /\b(\d{4})-(\d{2})-(\d{2})\b/g, read: (m) => ({ year: +m[1], month: +m[2], day: +m[3] }) },
  { re: new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+${MONTH}\.?${YEAR}(?![\p{L}])`, "giu"),
    read: (m) => ({ day: +m[1], month: MONTHS[m[2].toLowerCase()], year: m[3] ? +m[3] : null }) },
  { re: new RegExp(String.raw`\b${MONTH}\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b${YEAR}`, "giu"),
    read: (m) => ({ day: +m[2], month: MONTHS[m[1].toLowerCase()], year: m[3] ? +m[3] : null }) },
  { re: /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g, read: (m) => {
    const [a, b, year] = [+m[1], +m[2], +m[3]];
    if (a > 12 && b <= 12) return { day: a, month: b, year };
    if (b > 12 && a <= 12) return { day: b, month: a, year };
    return a === b ? { day: a, month: b, year } : "ambiguous";
  } },
];

const pad = (n: number) => String(n).padStart(2, "0");
const isCalendarDate = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

export type DateOptions = {
  /** Order of numeric dates where both readings are possible, from a reviewed site rule. */
  order?: "dmy" | "mdy";
};

export function normalizeDate(text: string, options: DateOptions = {}): NormalizeResult {
  // Earlier patterns win; a later match overlapping an earlier one is ignored.
  const taken: [number, number][] = [];
  const found: { text: string; index: number; read: ReturnType<(typeof PATTERNS)[number]["read"]> }[] = [];
  for (const p of PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      const start = m.index ?? 0, end = start + m[0].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      let read = p.read(m);
      if (read === "ambiguous" && options.order) {
        const [a, b] = [+m[1], +m[2]];
        read = options.order === "dmy" ? { day: a, month: b, year: +m[3] } : { day: b, month: a, year: +m[3] };
      }
      found.push({ text: m[0], index: start, read });
    }
  }
  if (!found.length) return fail(text, "no_value", "No date");
  if (found.length > 1) return fail(text, "several_values", `Several dates: ${found.sort((x, y) => x.index - y.index).map((f) => f.text).join(", ")}`);
  const { text: piece, read } = found[0];
  const raw = { text, unit: null };
  if (read === "ambiguous") {
    return { raw, readings: [{ status: "unresolved", text: piece, reason: { code: "date_order_ambiguous", detail: "Day and month could be swapped; the site rule must state the order" }, notes: [] }], failure: null };
  }
  if (read.year === null) {
    return { raw, readings: [{ status: "unresolved", text: piece, reason: { code: "year_missing", detail: "The source does not state the year; it is not inferred" }, notes: [] }], failure: null };
  }
  if (!isCalendarDate(read.year, read.month, read.day)) return fail(text, "invalid_date", `"${piece}" is not a calendar date`);
  return { raw, readings: [{ status: "ok", text: piece, value: { ...EMPTY_VALUE, date: `${read.year}-${pad(read.month)}-${pad(read.day)}` }, notes: [] }], failure: null };
}
