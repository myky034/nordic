// The "key information" checklist of a programme page (2026-10-13, after the
// owner found the page said nothing beyond the title). Pure and tested
// (AGENTS.md §16): which fact types a visitor expects to see for a programme,
// and which reviewed facts fill each slot. A slot with no fact is shown as
// "not available yet — see the official page"; nothing is estimated.

/**
 * Fact type keys, in the order visitors ask about them (fact-types-plan.md §6;
 * eight slots since L5 Q2, 2026-10-14). The same list is the "should have"
 * checklist of the mapping screen (lib/facts/mapping.ts).
 */
export const programmeSlotKeys = [
  "tuition_fee", "application_deadline", "programme_duration", "programme_credits", "study_mode", "teaching_language",
  "english_requirement", "prior_degree_requirement",
] as const;
export type ProgrammeSlotKey = (typeof programmeSlotKeys)[number];

/**
 * Extra fact types that also fill a slot. A slot answers one visitor question
 * ("when can I apply?", "which English do I need?") whichever way the page
 * states it: an exact date or a period, IELTS / TOEFL or a national level.
 * programme_duration_text (2026-10-14, retired after L4) keeps filling
 * "Duration" for facts typed with it.
 */
export const slotAlsoFilledBy: Partial<Record<ProgrammeSlotKey, readonly string[]>> = {
  application_deadline: ["application_period"],
  programme_duration: ["programme_duration_text"],
  english_requirement: ["min_ielts_overall", "min_toefl_ibt"],
};

type SlotFact = { fact_types?: { key?: string } | null; deadline_type?: string | null };

/**
 * Splits a programme's public facts into the checklist slots and the rest.
 * A fact fills a slot when its type has the slot's key; an untyped fact with
 * a deadline kind (fixed / rolling / year-round, Slice 5) also fills the
 * deadline slot, so deadlines entered before fact types existed still show.
 * Every fact appears exactly once.
 */
export function programmeSlots<T extends SlotFact>(facts: readonly T[]) {
  const slots = programmeSlotKeys.map((key) => ({ key, facts: [] as T[] }));
  const others: T[] = [];
  for (const fact of facts) {
    const key = fact.fact_types?.key ?? (fact.deadline_type ? "application_deadline" : null);
    const slot = slots.find((s) => s.key === key || (key !== null && slotAlsoFilledBy[s.key]?.includes(key)));
    if (slot) slot.facts.push(fact); else others.push(fact);
  }
  return { slots, others };
}
