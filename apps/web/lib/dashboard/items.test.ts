import { expect, it } from "vitest";
import { dashboardGroups, visibleCounters, visibleGroups } from "./items";

it("shows a member only personal and explore tiles", () => {
  const groups = visibleGroups([]);
  expect(groups.map((g) => g.id)).toEqual(["mine", "explore"]);
  expect(visibleCounters([])).toEqual([]);
});
it("shows each editing/admin tile only with a matching permission", () => {
  const ids = visibleGroups(["facts.propose"]).flatMap((g) => g.tiles.map((t) => t.href));
  expect(ids).toContain("/facts/workspace");
  expect(ids).toContain("/admin/extraction");
  expect(ids).not.toContain("/admin/crawler");
  expect(ids).not.toContain("/education/workspace");
  expect(visibleCounters(["facts.propose"]).map((c) => c.id)).toEqual(["extractionPending"]);
  expect(visibleCounters(["facts.review", "sources.manage"]).map((c) => c.id)).toEqual(["proposed", "sourceChanged", "extractionPending", "sourcesUnverified"]);
});
it("never lists the same destination twice", () => {
  const hrefs = dashboardGroups.flatMap((g) => g.tiles.map((t) => t.href));
  expect(new Set(hrefs).size).toBe(hrefs.length);
});
