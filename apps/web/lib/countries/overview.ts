import { defaultLocale, intlLocale, type Locale } from "@/lib/i18n/locales";

// Rules behind the country overview page (/countries/[slug]). Pure and tested
// (AGENTS.md §16): which fact topics answer which visitor question, how a count is
// worded, and how the page's "latest reviewed" date is chosen.

/**
 * Facts are grouped by the question a visitor comes with, not by entry date
 * (owner, 2026-10-02). Topic codes are the fixed extraction topics
 * (lib/facts/domain.ts); free-text topics typed by editors land in "other".
 * Used by the country page and by the /facts filter (?group=).
 */
export const questionGroups = [
  { key: "cost", question: "Học ở đây tốn bao nhiêu?", label: "Học phí & chi phí", topics: ["tuition", "scholarship", "living_cost", "housing"] },
  { key: "admission", question: "Nộp hồ sơ thế nào, khi nào?", label: "Tuyển sinh & hạn nộp", topics: ["education", "admission", "deadline", "language"] },
  { key: "permits", question: "Cần visa, giấy phép gì?", label: "Visa & giấy phép", topics: ["immigration"] },
  { key: "work", question: "Làm việc ở đây: lương và nhu cầu?", label: "Lương & việc làm", topics: ["labour_market"] },
] as const;
export const otherGroup = { key: "other", question: "Thông tin khác", label: "Khác" } as const;
export type GroupKey = (typeof questionGroups)[number]["key"] | typeof otherGroup.key;
const groupedTopics = questionGroups.flatMap((g) => [...g.topics]);

/** ?group= -> a known group key, or null (no filter). */
export function readQuestionGroup(value: unknown): GroupKey | null {
  if (value === otherGroup.key) return otherGroup.key;
  return questionGroups.find((g) => g.key === value)?.key ?? null;
}
// English wording of the same groups (PROJECT_SPEC.md, Decision Log 2026-10-06).
const groupTextEn: Record<GroupKey, { question: string; label: string }> = {
  cost: { question: "How much does it cost to study here?", label: "Tuition & costs" },
  admission: { question: "How and when do I apply?", label: "Admission & deadlines" },
  permits: { question: "Which visa or permit do I need?", label: "Visas & permits" },
  work: { question: "Working here: pay and demand?", label: "Pay & jobs" },
  other: { question: "Other information", label: "Other" },
};
/** Question and tab label of a group in the viewer's language. */
export function groupText(key: GroupKey, locale: Locale = defaultLocale) {
  if (locale === "en") return groupTextEn[key];
  const g = key === otherGroup.key ? otherGroup : questionGroups.find((x) => x.key === key)!;
  return { question: g.question, label: g.label };
}
export function groupLabel(key: GroupKey, locale: Locale = defaultLocale) {
  return groupText(key, locale).label;
}

/** The topic condition of a group: "in these topics", or for "other",
 *  "none of the grouped topics" — so every fact belongs to exactly one group. */
export function topicFilter(key: GroupKey): { in: string[] } | { notIn: string[] } {
  if (key === otherGroup.key) return { notIn: groupedTopics };
  return { in: [...questionGroups.find((g) => g.key === key)!.topics] };
}

/**
 * The tab opened on the country page: the one asked for (?group=) if valid,
 * else the first question that has something to show, so a visitor does not
 * land on an empty tab; "cost" when nothing is reviewed yet.
 */
export function openGroup(requested: unknown, totals: Partial<Record<GroupKey, number>>): GroupKey {
  const asked = readQuestionGroup(requested);
  if (asked) return asked;
  return [...questionGroups.map((g) => g.key), otherGroup.key].find((k) => (totals[k] ?? 0) > 0) ?? "cost";
}

/**
 * "4 trường" or, when nothing has been reviewed yet, an explicit sentence —
 * a zero is information ("not yet reviewed"), never an empty card or a guess
 * (AGENTS.md §1.1, §20).
 */
const countUnavailable = { vi: "Không tải được số liệu", en: "Could not load the count" } as const;
/** `line(formatted, n)` words a positive count ("12 trường", "12 universities"),
 *  so each language can handle its own plural. */
export function countLine(count: number | null, line: (formatted: string, n: number) => string, none: string, locale: Locale = defaultLocale) {
  if (count === null) return countUnavailable[locale];
  return count > 0 ? line(count.toLocaleString(intlLocale[locale]), count) : none;
}

/** Latest of the review dates shown on the page (ISO strings), or null when
 *  nothing about this country has been reviewed. */
export function latestReview(dates: (string | null | undefined)[]) {
  const known = dates.filter((d): d is string => !!d).sort();
  return known.length ? known[known.length - 1].slice(0, 10) : null;
}
