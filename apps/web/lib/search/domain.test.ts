import { expect, it } from "vitest";
import { groupHits, hitHref, seeAllHref, type SearchHit } from "./domain";

const hit = (entity_type: string, title = "t", total = 1): SearchHit => ({ entity_type, id: "i", title, subtitle: null, link_key: "k", rank: 0.1, total });
it("links each entity type to its detail page; facts go to their evidence document", () => {
  expect(hitHref(hit("country"))).toBe("/countries/k");
  expect(hitHref(hit("fact"))).toBe("/documents/k");
  expect(hitHref(hit("occupation"))).toBe("/occupations/k");
  expect(hitHref(hit("unknown"))).toBeNull();
});
it("builds encoded see-all links only for listable types", () => {
  expect(seeAllHref("programme", "data & ai")).toBe("/programmes?q=data%20%26%20ai");
  expect(seeAllHref("country", "x")).toBeNull();
});
it("groups in a fixed order, keeps totals and drops unknown types", () => {
  const groups = groupHits([hit("source"), hit("country", "Sweden", 1), hit("programme", "a", 12), hit("programme", "b", 12), hit("hacked")]);
  expect(groups.map((g) => g.type)).toEqual(["country", "programme", "source"]);
  expect(groups[1]).toMatchObject({ total: 12 });
  expect(groups[1].hits).toHaveLength(2);
});
