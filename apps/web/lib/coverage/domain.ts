import { questionGroups } from "@/lib/countries/overview";

// How much public data a country has, and whether the comparison page has
// enough to compare (UX review 2026-10-13, items C5 and B1;
// docs/product/ux-review.md). Pure rules, tested; the counts come from
// lib/coverage/queries.ts, which reads only what a signed-out visitor sees.
//
// Deliberately simple and published on the page: a label says which topics
// have data, never that a country is "good" or "complete" (AGENTS.md §11, §15).

/** The four visitor questions of the country page (lib/countries/overview.ts). */
export const coverageTopics = ["study", "cost", "permits", "work"] as const;
export type CoverageTopic = (typeof coverageTopics)[number];

export type CountryCounts = {
  programmes: number;
  rules: number;
  occupations: number;
  /** Public facts per fact topic code (tuition, immigration, labour_market…). */
  factsByTopic: Record<string, number>;
};

const factsIn = (counts: CountryCounts, group: (typeof questionGroups)[number]["key"]) =>
  questionGroups.find((g) => g.key === group)!.topics.reduce((n, topic) => n + (counts.factsByTopic[topic] ?? 0), 0);

/** Topics with at least one public item. Study counts programmes or admission facts, and so on. */
export function topicsCovered(counts: CountryCounts): CoverageTopic[] {
  const has: Record<CoverageTopic, boolean> = {
    study: counts.programmes > 0 || factsIn(counts, "admission") > 0,
    cost: factsIn(counts, "cost") > 0,
    permits: counts.rules > 0 || factsIn(counts, "permits") > 0,
    work: counts.occupations > 0 || factsIn(counts, "work") > 0,
  };
  return coverageTopics.filter((t) => has[t]);
}

export type CoverageLevel = "none" | "partial" | "all";
/** "none" → shown as "coming soon"; "all" means data in every topic, not that it is complete. */
export function coverageLevel(topics: readonly CoverageTopic[]): CoverageLevel {
  return topics.length === 0 ? "none" : topics.length === coverageTopics.length ? "all" : "partial";
}

/** The comparison page is offered once this many metrics have public values in at least two countries. */
export const COMPARE_MIN_METRICS = 3;
export const COMPARE_MIN_COUNTRIES = 2;
/** `values`: one entry per public fact typed with a comparable fact type (L3a). */
export function compareReady(values: readonly { fact_type_id: string; country_id: string }[]) {
  const countries = new Map<string, Set<string>>();
  for (const v of values) countries.set(v.fact_type_id, (countries.get(v.fact_type_id) ?? new Set()).add(v.country_id));
  return [...countries.values()].filter((c) => c.size >= COMPARE_MIN_COUNTRIES).length >= COMPARE_MIN_METRICS;
}

/** Countries with data first (more topics first), then the rest, each group in the given order. */
export function byCoverage<T extends { topics: readonly CoverageTopic[] }>(countries: readonly T[]): T[] {
  return countries.map((c, i) => ({ c, i })).sort((a, b) => b.c.topics.length - a.c.topics.length || a.i - b.i).map(({ c }) => c);
}
