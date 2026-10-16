import type { DocumentStructure } from "@nordic/db/document-structure";
import type { EvidenceRef, IntakeRef, IntakeTerm } from "@nordic/db/rule-output";

// PR 2b: the intake of a value, only from what the source states.
// - from a heading: the nearest heading above the value that matches the
//   rule's pattern (anchored, so "Changes to … autumn 2027" never matches an
//   intake pattern such as /^Autumn (?<year>\d{4}) …/). The heading must
//   name a term or a month; a year alone is not an intake.
// - from the page: the caller passes the intake the reviewed L7b records
//   bind the page to (PR 3); without it the intake is unresolved.
// Never from the URL, never from a date: "15 January" names no intake year.

const TERMS: Record<string, IntakeTerm> = { autumn: "autumn", fall: "autumn", spring: "spring", summer: "summer", winter: "winter" };
const MONTHS: Record<string, number> = {};
["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
  .forEach((m, i) => { MONTHS[m] = i + 1; MONTHS[m.slice(0, 3)] = i + 1; });

export type PageIntake = Extract<IntakeRef, { from: "page" }>;
export type IntakeResult = { intake: IntakeRef } | { unresolved: string | null };

type Doc = { documentId: string; structureId: string | null; structureHash: string };

export function intakeFromHeading(s: DocumentStructure, doc: Doc, section: readonly string[], pattern: RegExp): IntakeResult {
  for (let i = section.length - 1; i >= 0; i--) {
    const m = pattern.exec(section[i]);
    if (!m) continue;
    // The heading element itself, so the evidence names one element of this snapshot.
    const heading = s.headings.find((h) => h.text === section[i] && h.section.length === i && h.section.every((x, k) => x === section[k]));
    const year = Number(m.groups?.year);
    const term = TERMS[(m.groups?.term ?? "").toLowerCase()] ?? null;
    const month = MONTHS[(m.groups?.month ?? "").toLowerCase()] ?? null;
    if (!heading || !Number.isInteger(year) || (term === null && month === null)) return { unresolved: section[i] };
    const label = m.groups?.label ?? section[i];
    const evidence: EvidenceRef = { ...doc, ref: heading.ref, field: "text", excerpt: label };
    const when = term !== null ? { term, month } : { term: null, month: month as number };
    return { intake: { label, year, ...when, from: "heading", evidence } };
  }
  return { unresolved: null };
}
