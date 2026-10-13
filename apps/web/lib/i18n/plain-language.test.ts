import { expect, it } from "vitest";
import { dictionaries } from "./dictionaries";

// UX review 2026-10-13 (C4, KHLOE-141): visitor-facing text uses plain words.
// Registry jargon stays on editor and admin screens, and on the source
// registry pages (`sources`), where editors match codes with the registry.
const visitorSections = ["nav", "home", "countries", "country", "universities", "programmes", "immigration", "occupations", "facts", "search", "compare", "coverage", "wayOut"] as const;
const jargon = { vi: [/\bT[1-4]\b/, /\btier\b/i, /bằng chứng/i, /đối chiếu/i, /duyệt/i], en: [/\bT[1-4]\b/, /\btiers?\b/i, /\bevidence\b/i] };

// Every string in a section, including what text functions return.
function texts(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return texts((value as (...a: unknown[]) => unknown)("X", "Y", "Z"));
  if (Array.isArray(value)) return value.flatMap(texts);
  if (value && typeof value === "object") return Object.values(value).flatMap(texts);
  return [];
}

it.each(["vi", "en"] as const)("keeps registry jargon out of visitor pages (%s)", (locale) => {
  const offending = visitorSections.flatMap((section) => texts(dictionaries[locale][section])
    .filter((t) => jargon[locale].some((re) => re.test(t))).map((t) => `${section}: ${t}`));
  expect(offending).toEqual([]);
});
