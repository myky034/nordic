import { describe, expect, it } from "vitest";
import { normalize, normalizeCredits, normalizeDate, normalizeDuration, normalizeMoney, normalizePace, type NormalizeResult } from "./index";

// PR 2a (review §5.5): every "does" and "does not" row is a test. Texts are
// short synthetic sentences shaped like the Stockholm University and KTH
// pages; no third-party page text is copied.

const ok = (r: NormalizeResult) => r.readings.filter((x) => x.status === "ok").map((x) => x.status === "ok" && x.value);
const unresolved = (r: NormalizeResult) => r.readings.flatMap((x) => (x.status === "unresolved" ? [x.reason.code] : []));
const failure = (r: NormalizeResult) => r.failure?.code ?? null;

describe("duration", () => {
  it.each([
    ["The programme takes 2 years.", "24", "years"],
    ["This is a two-year programme (120 ECTS credits) given in English.", "24", "years"],
    ["Duration: 18 months", "18", "months"],
    ["1.5 years full-time", "18", "years"],
    ["1,5 years", "18", "years"],
    ["2 years at 50% pace", "24", "years"],
  ])("%s → %s months", (text, months, unit) => {
    const r = normalizeDuration(text);
    expect(failure(r)).toBeNull();
    expect(ok(r)).toEqual([{ number: months, currency: null, period: null, date: null, unit: "months" }]);
    expect(r.raw).toEqual({ text, unit });
  });
  it("keeps the original wording and says how it converted", () => {
    const r = normalizeDuration("The programme takes 2 years.");
    expect(r.readings[0]).toMatchObject({ text: "2 years", notes: ["2 years → 24 months (12 months per year)"] });
  });
  it.each([
    ["One Year Master’s Programme in IT Project Management, 60 credits", "degree_name"],
    ["One-year master's programme", "degree_name"],
    ["31/08/2026 - 04/06/2028", "schedule_not_duration"],
    ["The programme is four semesters long", "semesters_not_converted"],
    ["60 credits", "no_value"],
    ["Half-time, 50%", "no_value"],
    ["1 year or 2 years depending on track", "several_values"],
  ])("%s → %s (no duration computed)", (text, code) => {
    const r = normalizeDuration(text);
    expect(failure(r)).toBe(code);
    expect(r.readings).toEqual([]);
  });
  describe("M2: ranges are never reduced to one value (PR #5 review)", () => {
    it.each([
      ["2–3 years", "2–3 years"],
      ["2-3 years", "2-3 years"],
      ["2 — 3 years", "2 — 3 years"],
      ["The programme takes 2 to 3 years.", "2 to 3 years"],
      ["between 1 and 2 years", "between 1 and 2 years"],
      ["18–24 months", "18–24 months"],
      ["1.5-2 years full-time", "1.5-2 years"],
      ["2 years to 3 years", "2 years to 3 years"],
      ["two to three years", "two to three years"],
    ])("%s → unresolved range, expression kept", (text, piece) => {
      const r = normalizeDuration(text);
      expect(r.failure).toBeNull();
      expect(r.readings).toEqual([{ status: "unresolved", text: piece, reason: { code: "range", detail: expect.any(String) }, notes: [] }]);
      expect(ok(r)).toEqual([]);
    });
    it("a hyphenated single duration is not a range", () => {
      expect(ok(normalizeDuration("This is a two-year programme"))[0]).toMatchObject({ number: "24" });
      expect(ok(normalizeDuration("a 2-year programme"))[0]).toMatchObject({ number: "24" });
    });
  });
  it("never derives a duration from credits or pace", () => {
    expect(failure(normalizeDuration("60 credits at 50% pace"))).toBe("no_value");
  });
});

describe("credits", () => {
  it.each([
    ["This is a two-year programme (120 ECTS credits)", "120", "ECTS"],
    ["120 ECTS", "120", "ECTS"],
    ["Master's thesis 15 credits", "15", "credits"],
    ["Trends in Project Management, 7.5 hp", "7.5", "hp"],
    ["30 högskolepoäng", "30", "hp"],
    ["60 credits (60 credits)", "60", "credits"],
  ])("%s → %s %s, unit kept as written", (text, number, unit) => {
    const r = normalizeCredits(text);
    expect(ok(r)).toEqual([{ number, currency: null, period: null, date: null, unit }]);
  });
  it("never converts hp or plain credits to ECTS", () => {
    expect(ok(normalizeCredits("7.5 hp"))[0]).toMatchObject({ unit: "hp", number: "7.5" });
    expect(ok(normalizeCredits("60 credits"))[0]).toMatchObject({ unit: "credits" });
  });
  it.each([
    ["Mandatory courses 2 x 7.5 credits", "multiplied"],
    ["60 credits / 90 ECTS", "several_values"],
    ["A Bachelor degree with at least 180 ECTS credits and 60 credits in IT", "several_values"],
    ["Credits are listed per course", "no_value"],
  ])("%s → %s", (text, code) => expect(failure(normalizeCredits(text))).toBe(code));
});

describe("money", () => {
  it("reads each stated amount with its own period; an instalment has no period", () => {
    const r = normalizeMoney("First instalment: 67500 SEK. The complete course: 135000 SEK");
    expect(r.failure).toBeNull();
    expect(r.readings).toEqual([
      { status: "unresolved", text: "67500 SEK", reason: { code: "period_unknown", detail: expect.any(String) }, notes: [] },
      { status: "ok", text: "135000 SEK", value: { number: "135000", currency: "SEK", period: "total", date: null, unit: null }, notes: [] },
    ]);
  });
  it("a reviewed site rule may name its wording, e.g. instalments", () => {
    const r = normalizeMoney("First instalment: 67500 SEK", { periods: { "first instalment": "one_off" } });
    expect(ok(r)).toEqual([{ number: "67500", currency: "SEK", period: "one_off", date: null, unit: null }]);
  });
  it.each([
    ["Tuition fee: SEK 145,000 per academic year", "145000", "SEK", "year"],
    ["€ 7 500 per semester", "7500", "EUR", "semester"],
    ["Total cost 135 000 SEK", "135000", "SEK", "total"],
    ["Application fee 900 SEK (one-off)", "900", "SEK", "one_off"],
    ["EUR 1.234,50 per month", "1234.50", "EUR", "month"],
    ["£12,000 a year", "12000", "GBP", "year"],
  ])("%s → %s %s %s", (text, number, currency, period) => {
    expect(ok(normalizeMoney(text))).toEqual([{ number, currency, period, date: null, unit: null }]);
  });
  it.each([
    ["Tuition 70000 kr per year", "currency_ambiguous"],
    ["$20,000 per year", "currency_ambiguous"],
    ["Tuition fee: 135000 SEK", "period_unknown"],
    ["135000 SEK per year in total", "period_ambiguous"],
  ])("%s → unresolved %s (no structured amount)", (text, code) => {
    const r = normalizeMoney(text);
    expect(unresolved(r)).toEqual([code]);
    expect(ok(r)).toEqual([]);
  });
  it("does not read applicant groups, codes that are not currencies, or amounts without a currency", () => {
    expect(failure(normalizeMoney("Applies to citizens from outside EU, EEA or Switzerland."))).toBe("no_value");
    expect(failure(normalizeMoney("EEA 2026"))).toBe("no_value");
    expect(failure(normalizeMoney("Fee: 67500"))).toBe("no_value");
    const r = normalizeMoney("Applies to citizens from outside EU, EEA or Switzerland. The complete course: 135000 SEK");
    expect(Object.keys(r.readings[0].status === "ok" ? r.readings[0].value : {})).toEqual(["number", "currency", "period", "date", "unit"]);
  });
  describe("M1: where a space-grouped amount begins (PR #5 review)", () => {
    it.each([
      "Year 1 135 000 SEK per year",
      "Period 2 1 500 SEK per semester",
      "Tuition 1 135 000 SEK per year",
      "Year 1\u00a0135\u00a0000 SEK per year",
    ])("%s → unresolved, original text kept, no amount chosen", (text) => {
      const r = normalizeMoney(text);
      expect(ok(r)).toEqual([]);
      expect(unresolved(r)).toEqual(["amount_boundary_ambiguous"]);
      expect(r.raw.text).toBe(text);
    });
    it.each([
      ["1 135 000 SEK per year", "1135000"],
      ["Fee: 1 135 000 SEK per year", "1135000"],
      ["SEK 1 135 000 per year", "1135000"],
      ["Total cost 135 000 SEK", "135000"],
      ["Year 1 fee 135 000 SEK per year", "135000"],
      ["Fee 2026 135 000 SEK per year", "135000"],
      ["Year 1: 135,000 SEK per year", "135000"],
      ["1\u202f135\u202f000 SEK per year", "1135000"],
    ])("%s → %s (boundary is clear)", (text, number) => {
      expect(ok(normalizeMoney(text))[0]).toMatchObject({ number, currency: "SEK" });
    });
  });
  describe("M3: a period qualifies only the amount it belongs to (PR #6 review)", () => {
    const periodsOf = (text: string) => normalizeMoney(text).readings.map((r) => (r.status === "ok" ? `${r.text}=${r.value.period}` : `${r.text}?${r.reason.code}`));
    it.each<[string, string[]]>([
      // Two amounts in one sentence, each with its own wording.
      ["Fee 30000 SEK per semester, total 120000 SEK for the full programme", ["30000 SEK=semester", "120000 SEK=total"]],
      ["100 SEK per year and 200 SEK per semester", ["100 SEK=year", "200 SEK=semester"]],
      ["Tuition: 50 000 SEK/semester (total 200 000 SEK)", ["50 000 SEK=semester", "200 000 SEK=total"]],
      // A period expression between two amounts belongs to neither "a total of" reading.
      ["Tuition fee 100000 SEK, of which a total of 20000 SEK is paid at registration", ["100000 SEK?period_unknown", "20000 SEK?period_unknown"]],
      // "a year" in descriptive text is not a fee period.
      ["Tuition 100000 SEK for students who spend a year in Sweden", ["100000 SEK?period_unknown"]],
      ["Tuition 100000 SEK; you may spend a semester abroad", ["100000 SEK?period_unknown"]],
      // Explicit per-year and total tuition.
      ["Tuition fee: SEK 145,000 per academic year", ["SEK 145,000=year"]],
      ["£12,000 a year", ["£12,000=year"]],
      ["Total tuition fee: 200000 SEK", ["200000 SEK=total"]],
      ["The complete course: 135000 SEK", ["135000 SEK=total"]],
      ["Application fee 900 SEK (one-off)", ["900 SEK=one_off"]],
      // Ambiguous wording stays unresolved.
      ["135000 SEK per year in total", ["135000 SEK?period_ambiguous"]],
      ["Tuition 50000 SEK. Total cost of living 12000 SEK per month", ["50000 SEK?period_unknown", "12000 SEK?period_ambiguous"]],
    ])("%s → %j", (text, expected) => {
      expect(periodsOf(text)).toEqual(expected);
    });
    it("keeps the raw text and never states an applicant group", () => {
      const r = normalizeMoney("Applies to citizens from outside EU, EEA or Switzerland. The complete course: 135000 SEK.");
      expect(r.raw.text).toBe("Applies to citizens from outside EU, EEA or Switzerland. The complete course: 135000 SEK.");
      expect(r.readings).toEqual([{ status: "ok", text: "135000 SEK", value: { number: "135000", currency: "SEK", period: "total", date: null, unit: null }, notes: [] }]);
    });
  });
  it("does not take digits of a longer number", () => {
    expect(failure(normalizeMoney("Ukr 2026"))).toBe("no_value");
  });
});

describe("date", () => {
  it.each([
    ["Application opens 16 October 2026", "2026-10-16"],
    ["16 October (2026): Application opens", "2026-10-16"],
    ["Deadline: 2027-01-15", "2027-01-15"],
    ["Last day: January 15, 2027", "2027-01-15"],
    ["Sista dag 15 januari 2027", "2027-01-15"],
    ["Start 31/08/2026", "2026-08-31"],
    ["1st February 2027: Submit documents", "2027-02-01"],
  ])("%s → %s", (text, date) => expect(ok(normalizeDate(text))).toEqual([{ number: null, currency: null, period: null, date, unit: null }]));
  it("keeps a date without a year as text, even near a year in a heading (D6)", () => {
    const r = normalizeDate("15 January: Last day to apply");
    expect(r.readings).toEqual([{ status: "unresolved", text: "15 January", reason: { code: "year_missing", detail: expect.any(String) }, notes: [] }]);
    expect(ok(r)).toEqual([]);
  });
  it("needs the site's order for a numeric date that reads both ways", () => {
    expect(unresolved(normalizeDate("Ends 04/06/2028"))).toEqual(["date_order_ambiguous"]);
    expect(ok(normalizeDate("Ends 04/06/2028", { order: "dmy" }))[0]).toMatchObject({ date: "2028-06-04" });
    expect(ok(normalizeDate("Ends 04/06/2028", { order: "mdy" }))[0]).toMatchObject({ date: "2028-04-06" });
  });
  it.each([
    ["31/08/2026 - 04/06/2028", "several_values"],
    ["16 October (2026): Application opens\n15 January: Last day to apply", "several_values"],
    ["30 February 2027", "invalid_date"],
    ["Closed for application", "no_value"],
  ])("%s → %s", (text, code) => expect(failure(normalizeDate(text))).toBe(code));
});

describe("pace", () => {
  it.each([
    ["Day-time, 50%", "50"],
    ["Study pace 100 %", "100"],
    ["Pace: 75%", "75"],
  ])("%s → %s percent", (text, number) => expect(ok(normalizePace(text))).toEqual([{ number, currency: null, period: null, date: null, unit: "percent" }]));
  it.each([
    ["This is a half-time study pace online programme", "words_not_converted"],
    ["Part-time", "words_not_converted"],
    ["50% or 100% pace", "several_values"],
    ["150%", "out_of_range"],
    ["Online", "no_value"],
  ])("%s → %s", (text, code) => expect(failure(normalizePace(text))).toBe(code));
});

describe("dispatcher and determinism", () => {
  it("text facts keep only the words", () => {
    expect(ok(normalize({ kind: "text" }, "English 6 or English level 2"))).toEqual([{ number: null, currency: null, period: null, date: null, unit: null }]);
  });
  it("same input gives the same output, every time", () => {
    const texts = ["First instalment: 67500 SEK. The complete course: 135000 SEK", "two-year programme (120 ECTS credits)", "15 January: Last day to apply", "Day-time, 50%"];
    for (const t of texts) {
      for (const spec of [{ kind: "money" }, { kind: "duration" }, { kind: "credits" }, { kind: "date" }, { kind: "pace" }] as const) {
        expect(JSON.stringify(normalize(spec, t))).toBe(JSON.stringify(normalize(spec, t)));
      }
    }
  });
});
