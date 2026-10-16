import type { PageTypeDef } from "../match";
import type { Rule } from "../types";

// Stockholm University programme pages (structure seen on the SPROM HT2026 and
// HT2027 snapshots, 2026-10-15). One page per intake: the intake heading reads
// "Autumn 2027 | Period 1 | Day-time, 50% | …", and the facts that sit under it
// are label/value pairs and short paragraphs. Only intake-specific types take
// the intake from that heading (D2); tuition and language do not, even though
// they sit under it (Risk C). The page also mentions other intakes ("Changes
// to the selection process for autumn 2027" on the 2026 page): the anchored
// intake pattern does not match such headings.

const SOURCE = "https://www.su.se";
/**
 * Intake heading: a term and a year, then — on the real pages — the offering
 * details separated by " | " (literal text in the source). Only that form is
 * accepted, so a heading such as "Autumn 2027 selection changes" is not an
 * intake heading (PR #6 review m1).
 */
const INTAKE_HEADING = /^(?<label>(?<term>Autumn|Spring|Summer) (?<year>\d{4}))(?: \| [^|]+)*$/;

export const SU_PAGE_TYPES: PageTypeDef[] = [
  // The query names the intake page, but only the page TYPE is read from it, never the intake.
  { source: SOURCE, type: "programme_intake", url: /^https:\/\/www\.su\.se\/english\/education\/course-catalogue\/[a-z0-9]+\/[a-z0-9]+\?semester=(?:HT|VT)\d{4}&eventcode=\d+$/ },
];

const base = { version: 1, enabled: true, mode: "shadow", priority: 0, scope: { source: SOURCE, pageType: "programme_intake" } } as const;

export const SU_RULES: Rule[] = [
  { ...base, id: "su.teaching_language.pair", field: "teaching_language",
    strategy: { kind: "pair", labels: ["Language"] }, normalize: { kind: "text" }, intake: { from: "none" }, evidence: "canonical" },
  { ...base, id: "su.tuition_fee.pair", field: "tuition_fee",
    strategy: { kind: "pair", labels: ["Tuition fee"] }, normalize: { kind: "money" }, intake: { from: "none" }, evidence: "value" },
  // v2 (PR #6 review m1): stricter intake heading pattern.
  { ...base, version: 2, id: "su.programme_credits.intake_block", field: "programme_credits",
    strategy: { kind: "sentence", heading: INTAKE_HEADING, pattern: /^(?<value>\d+(?:[.,]\d+)? credits)$/ }, normalize: { kind: "credits" }, intake: { from: "none" }, evidence: "text" },
  // v2 (PR #6 review m1): stricter intake heading pattern.
  { ...base, version: 2, id: "su.application_period.opens", field: "application_period",
    strategy: { kind: "sentence", heading: INTAKE_HEADING, pattern: /^Application opens \d{1,2} [A-Z][a-z]+ \d{4}$/ }, normalize: { kind: "text" },
    intake: { from: "heading", pattern: INTAKE_HEADING }, evidence: "text" },
  { ...base, id: "su.programme_duration.sentence", field: "programme_duration",
    strategy: { kind: "sentence", pattern: /\btakes (?<value>[a-z0-9.,]+ (?:years?|months?)) to complete\b/ }, normalize: { kind: "duration" }, intake: { from: "none" }, evidence: "text" },
];
