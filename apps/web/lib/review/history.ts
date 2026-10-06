import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import type { Tone } from "@/components/ui";

// Readable decision history. The review tables store codes (`reviewed`,
// `revalidated`…) and ids; people need the item's name and a plain verb.

export const decisionLabels: Record<string, { label: string; tone: Tone }> = {
  reviewed: { label: "Đã duyệt", tone: "accent" },
  rejected: { label: "Đã từ chối", tone: "neutral" },
  conflicted: { label: "Đánh dấu mâu thuẫn", tone: "critical" },
  revalidated: { label: "Vẫn khớp nguồn mới", tone: "accent" },
};
const decisionLabelsEn: Record<string, string> = { reviewed: "Reviewed", rejected: "Rejected", conflicted: "Marked as conflicting", revalidated: "Still matches the new source" };

export function decisionLabel(decision: string, locale: Locale = defaultLocale) {
  const d = Object.hasOwn(decisionLabels, decision) ? decisionLabels[decision] : null;
  if (!d) return { label: decision, tone: "neutral" as Tone };
  return locale === "en" ? { ...d, label: decisionLabelsEn[decision] } : d;
}

/**
 * Server-rendered time, so the zone is stated instead of implied: the server
 * runs in UTC and a bare "10:20" would look like local time.
 */
export function decisionTime(iso: string, locale: Locale = defaultLocale) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return locale === "en" ? "Unknown time" : "Không rõ thời gian";
  const [date, time] = d.toISOString().split("T");
  return `${date} ${time.slice(0, 5)} UTC`;
}

/** Fact rows are named "subject — predicate", the same way the fact card shows them. */
export function factName(fact: { subject: string; predicate: string } | null | undefined, locale: Locale = defaultLocale) {
  return fact ? `${fact.subject} — ${fact.predicate}` : locale === "en" ? "Fact no longer accessible" : "Thông tin không còn truy cập được";
}
