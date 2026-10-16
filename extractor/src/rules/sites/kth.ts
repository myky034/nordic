import type { PageTypeDef } from "../match";
import type { Rule } from "../types";

// KTH master's programme pages (structure seen on the Industrial Management and
// Interactive Media Technology snapshots, 2026-10-15). One page per programme;
// no label/value pairs. Deadlines are lines of ONE paragraph under a heading
// naming the intake month ("Application deadlines for studies starting August
// 2027"), written "15 January: Last day to apply": the year of such a date is
// not stated and is not inferred (D6). Fees are on another page, not read here.

const SOURCE = "https://www.kth.se";
const DEADLINE_HEADING = /^Application deadlines for studies starting (?<label>(?<month>[A-Z][a-z]+) (?<year>\d{4}))$/;

export const KTH_PAGE_TYPES: PageTypeDef[] = [
  { source: SOURCE, type: "programme", url: /^https:\/\/www\.kth\.se\/en\/studies\/master\/[a-z0-9-]+\/?$/ },
];

const base = { version: 1, enabled: true, mode: "shadow", priority: 0, scope: { source: SOURCE, pageType: "programme" } } as const;

export const KTH_RULES: Rule[] = [
  { ...base, id: "kth.application_deadline.lines", field: "application_deadline",
    strategy: { kind: "section_lines", heading: DEADLINE_HEADING, line: /^(?<value>\d{1,2} [A-Z][a-z]+(?: \(\d{4}\))?): Last day to apply$/ },
    normalize: { kind: "date" }, intake: { from: "heading", pattern: DEADLINE_HEADING }, evidence: "text" },
  { ...base, id: "kth.application_period.opens", field: "application_period",
    strategy: { kind: "section_lines", heading: DEADLINE_HEADING, line: /^\d{1,2} [A-Z][a-z]+(?: \(\d{4}\))?: Application opens$/ },
    normalize: { kind: "text" }, intake: { from: "heading", pattern: DEADLINE_HEADING }, evidence: "text" },
  { ...base, id: "kth.programme_duration.sentence", field: "programme_duration",
    strategy: { kind: "sentence", pattern: /\bThis is a (?<value>(?:one|two|three|four|\d+)[- ]year) programme\b/ }, normalize: { kind: "duration" }, intake: { from: "none" }, evidence: "text" },
  { ...base, id: "kth.programme_credits.sentence", field: "programme_credits",
    strategy: { kind: "sentence", pattern: /\((?<value>\d+ ECTS credits)\)/ }, normalize: { kind: "credits" }, intake: { from: "none" }, evidence: "text" },
  { ...base, id: "kth.teaching_language.sentence", field: "teaching_language",
    strategy: { kind: "sentence", pattern: /\bgiven in (?<value>English|Swedish)\b/ }, normalize: { kind: "text" }, intake: { from: "none" }, evidence: "text" },
];
