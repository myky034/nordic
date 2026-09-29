import type { Tone } from "@/components/ui";

// Readable decision history. The review tables store codes (`reviewed`,
// `revalidated`…) and ids; people need the item's name and a plain verb.

export const decisionLabels: Record<string, { label: string; tone: Tone }> = {
  reviewed: { label: "Đã duyệt", tone: "accent" },
  rejected: { label: "Đã từ chối", tone: "neutral" },
  conflicted: { label: "Đánh dấu mâu thuẫn", tone: "critical" },
  revalidated: { label: "Vẫn khớp nguồn mới", tone: "accent" },
};

export function decisionLabel(decision: string) {
  return decisionLabels[decision] ?? { label: decision, tone: "neutral" as Tone };
}

/**
 * Server-rendered time, so the zone is stated instead of implied: the server
 * runs in UTC and a bare "10:20" would look like local time.
 */
export function decisionTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Không rõ thời gian";
  const [date, time] = d.toISOString().split("T");
  return `${date} ${time.slice(0, 5)} UTC`;
}

/** Fact rows are named "subject — predicate", the same way the fact card shows them. */
export function factName(fact: { subject: string; predicate: string } | null | undefined) {
  return fact ? `${fact.subject} — ${fact.predicate}` : "Thông tin không còn truy cập được";
}
