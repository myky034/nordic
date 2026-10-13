// The "key information" checklist of a programme page (2026-10-13, after the
// owner found the page said nothing beyond the title). Pure and tested
// (AGENTS.md §16): which fact types a visitor expects to see for a programme,
// and which reviewed facts fill each slot. A slot with no fact is shown as
// "not available yet — see the official page"; nothing is estimated.

/** Fact type keys, in the order visitors ask about them (docs/architecture/fact-types-plan.md §6). */
export const programmeSlotKeys = [
  "tuition_fee", "application_deadline", "programme_duration", "min_ielts_overall", "min_toefl_ibt", "prior_degree_requirement",
] as const;
export type ProgrammeSlotKey = (typeof programmeSlotKeys)[number];

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
    const slot = slots.find((s) => s.key === key);
    if (slot) slot.facts.push(fact); else others.push(fact);
  }
  return { slots, others };
}
