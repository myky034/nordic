// L5 "map facts" screen (docs/architecture/mapping-screen-plan.md). Pure,
// tested helpers (AGENTS.md §16): where a fact's excerpt sits in the page
// text, how the text splits into highlighted segments, and what the page
// still lacks. The database re-checks every proposal (propose_fact).
import { programmeSlots, type ProgrammeSlotKey } from "@/lib/education/programme-slots";

export type Range = { start: number; end: number };

/**
 * Finds an excerpt in the page text, ignoring case and differences in
 * whitespace (line breaks, double spaces): the stored text keeps the page's
 * line breaks while excerpts are often on one line. Returns offsets in the
 * ORIGINAL text, or null when it is not there (e.g. the page changed).
 */
export function findExcerpt(text: string, excerpt: string): Range | null {
  const norm: string[] = [];
  const at: number[] = []; // norm index → original index
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (norm.length && norm[norm.length - 1] !== " ") { norm.push(" "); at.push(i); }
    } else { norm.push(ch.toLowerCase()); at.push(i); }
  }
  const needle = excerpt.replace(/\s+/g, " ").trim().toLowerCase();
  if (!needle) return null;
  const pos = norm.join("").indexOf(needle);
  if (pos < 0) return null;
  return { start: at[pos], end: at[pos + needle.length - 1] + 1 };
}

export type Segment<T> = { start: number; end: number; text: string; mark: T | null };
/**
 * Splits the text into plain and marked segments. Overlapping marks are not
 * nested: the earlier (by start) wins and the overlap stays with it, so every
 * character belongs to exactly one segment.
 */
export function segments<T>(text: string, marks: { range: Range; mark: T }[]): Segment<T>[] {
  const sorted = [...marks].sort((a, b) => a.range.start - b.range.start);
  const out: Segment<T>[] = [];
  let pos = 0;
  for (const { range, mark } of sorted) {
    if (range.end <= pos) continue;
    const start = Math.max(range.start, pos);
    if (start > pos) out.push({ start: pos, end: start, text: text.slice(pos, start), mark: null });
    out.push({ start, end: range.end, text: text.slice(start, range.end), mark });
    pos = range.end;
  }
  if (pos < text.length) out.push({ start: pos, end: text.length, text: text.slice(pos), mark: null });
  return out;
}

/** Widens a selection to whole lines, for excerpts too short to stand alone ("60 credits"). */
export function expandToLines(text: string, range: Range, extraLines = 1): Range {
  let start = text.lastIndexOf("\n", range.start - 1) + 1;
  let end = text.indexOf("\n", range.end);
  end = end < 0 ? text.length : end;
  for (let i = 0; i < extraLines && end < text.length; i++) {
    const next = text.indexOf("\n", end + 1);
    end = next < 0 ? text.length : next;
  }
  // Keep the database limit of 500 characters.
  if (end - start > 500) { start = range.start; end = Math.min(text.length, range.start + 500); }
  return { start, end };
}

export type SlotState = "reviewed" | "proposed" | "missing";
type ChecklistFact = { id: string; status: string; value: string; fact_types?: { key?: string } | null; deadline_type?: string | null };
/**
 * The "should have" list of a programme page: the key-information slots of
 * the public programme page, each with the best state among its facts.
 * Rejected facts do not count.
 */
export function programmeChecklist<T extends ChecklistFact>(facts: readonly T[]): { key: ProgrammeSlotKey; state: SlotState; facts: T[] }[] {
  const { slots } = programmeSlots(facts.filter((f) => f.status !== "rejected"));
  return slots.map((s) => ({
    key: s.key,
    facts: s.facts,
    state: s.facts.some((f) => f.status === "reviewed" || f.status === "conflicted") ? "reviewed" : s.facts.length ? "proposed" : "missing",
  }));
}

// Fact type categories → proposal topics (extraction_topics()); the editor can change it.
const topicByCategory: Record<string, string> = {
  education: "education", tuition: "tuition", living_cost: "living_cost", labour_market: "labour_market",
  immigration: "immigration", housing: "housing", language: "language",
};
export const topicForCategory = (category: string | null | undefined) => (category && topicByCategory[category]) || "other";
