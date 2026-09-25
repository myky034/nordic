// Presentation rules for search results: group order, labels and where each
// hit links to. Pure functions so they are testable without the database.
export const searchGroups = [
  ["country", "Countries"], ["programme", "Programmes"], ["university", "Universities"],
  ["immigration_rule", "Immigration rules"], ["occupation", "Occupations"], ["fact", "Facts"],
  ["source", "Sources"], ["document", "Documents"],
] as const;
export type SearchEntity = (typeof searchGroups)[number][0];

export type SearchHit = { entity_type: string; id: string; title: string; subtitle: string | null; link_key: string; rank: number; total: number };

/** Detail link for one hit. Facts have no page of their own: link their document. */
export function hitHref(hit: Pick<SearchHit, "entity_type" | "link_key">) {
  switch (hit.entity_type) {
    case "country": return `/countries/${hit.link_key}`;
    case "programme": return `/programmes/${hit.link_key}`;
    case "university": return `/universities/${hit.link_key}`;
    case "immigration_rule": return `/immigration/${hit.link_key}`;
    case "occupation": return `/occupations/${hit.link_key}`;
    case "source": return `/sources/${hit.link_key}`;
    case "document": case "fact": return `/documents/${hit.link_key}`;
    default: return null;
  }
}

/** "See all" goes to the entity's own list, filtered by the same text. */
export function seeAllHref(entity: string, q: string) {
  const list: Record<string, string> = {
    programme: "/programmes", university: "/universities", immigration_rule: "/immigration", occupation: "/occupations",
    fact: "/facts", source: "/sources", document: "/documents",
  };
  return list[entity] ? `${list[entity]}?q=${encodeURIComponent(q)}` : null;
}

/** Groups hits in a fixed, predictable order; unknown types are dropped. */
export function groupHits(hits: SearchHit[]) {
  return searchGroups
    .map(([type, label]) => ({ type, label, hits: hits.filter((h) => h.entity_type === type), total: Number(hits.find((h) => h.entity_type === type)?.total ?? 0) }))
    .filter((g) => g.hits.length > 0);
}
