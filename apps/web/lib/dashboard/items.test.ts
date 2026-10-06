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

it("translates every group, tile and counter for English, and keeps the permission rules", async () => {
  const { counters, counterLabel, dashboardGroups, localizeGroups, visibleGroups } = await import("./items");
  const english = localizeGroups(dashboardGroups, "en");
  // Every tile has an English title (none left identical to its Vietnamese one, except names such as "Crawler").
  for (const [i, g] of english.entries()) for (const [j, t] of g.tiles.entries()) {
    if (t.title === dashboardGroups[i].tiles[j].title) expect(t.title).toBe("Crawler");
    expect(t.anyOf).toEqual(dashboardGroups[i].tiles[j].anyOf);
  }
  expect(localizeGroups(visibleGroups([]), "en").map((g) => g.title)).toEqual(["Yours", "Explore"]);
  expect(counters.map((c) => counterLabel(c, "en"))).toEqual(["Proposals awaiting review", "Changed sources", "AI requests waiting", "Sources to verify"]);
});
