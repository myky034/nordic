import { expect, it } from "vitest";
import { byCoverage, compareReady, coverageLevel, topicsCovered } from "./domain";

const none = { programmes: 0, rules: 0, occupations: 0, factsByTopic: {} };

it("says which visitor topics have public data, from entities or facts", () => {
  expect(topicsCovered(none)).toEqual([]);
  expect(topicsCovered({ ...none, programmes: 1, rules: 3, occupations: 8, factsByTopic: { immigration: 4, labour_market: 3, other: 1 } })).toEqual(["study", "permits", "work"]);
  expect(topicsCovered({ ...none, factsByTopic: { tuition: 1 } })).toEqual(["cost"]);
  expect(topicsCovered({ ...none, factsByTopic: { deadline: 1 } })).toEqual(["study"]);
  // "other" facts answer no visitor question, so they do not count as coverage.
  expect(topicsCovered({ ...none, factsByTopic: { other: 5 } })).toEqual([]);
});
it("labels none, partial or all topics — never more than what is there", () => {
  expect(coverageLevel([])).toBe("none");
  expect(coverageLevel(["study", "permits"])).toBe("partial");
  expect(coverageLevel(["study", "cost", "permits", "work"])).toBe("all");
});
it("offers the comparison only with at least 3 metrics that have values in at least 2 countries", () => {
  const v = (fact_type_id: string, country_id: string) => ({ fact_type_id, country_id });
  expect(compareReady([])).toBe(false);
  // Many values in one country compare nothing.
  expect(compareReady([v("a", "se"), v("a", "se"), v("b", "se"), v("c", "se")])).toBe(false);
  expect(compareReady([v("a", "se"), v("a", "dk"), v("b", "se"), v("b", "dk")])).toBe(false);
  expect(compareReady([v("a", "se"), v("a", "dk"), v("b", "se"), v("b", "fi"), v("c", "no"), v("c", "nl")])).toBe(true);
});
it("puts countries with data first and keeps the given order otherwise", () => {
  const list = [{ slug: "dk", topics: [] }, { slug: "se", topics: ["study", "permits"] }, { slug: "fi", topics: ["cost"] }, { slug: "no", topics: [] }] as const;
  expect(byCoverage(list).map((c) => c.slug)).toEqual(["se", "fi", "dk", "no"]);
});
