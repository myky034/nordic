import { expect, it } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";
import { vi } from "@/lib/i18n/dictionaries/vi";
import { entryActive, navigationFor } from "./menu";
const navigation = navigationFor(vi.nav);

it("keeps every public module reachable exactly once", () => {
  const hrefs = navigation.flatMap((e) => (e.href ? [e.href] : (e.links ?? []).map((l) => l.href)));
  expect(hrefs.sort()).toEqual(["/compare", "/countries", "/documents", "/facts", "/immigration", "/occupations", "/programmes", "/sources", "/universities"]);
  expect(navigation.length).toBeLessThanOrEqual(5); // few top-level labels so the bar never truncates
});
it("marks a group active for any page inside it, but not for look-alike paths", () => {
  const study = navigation.find((e) => e.id === "study")!;
  expect(entryActive("/programmes/abc", study)).toBe(true);
  expect(entryActive("/universities", study)).toBe(true);
  expect(entryActive("/programmes-archive", study)).toBe(false);
  expect(entryActive("/facts", study)).toBe(false);
});

it("builds the same destinations in every language, with translated labels", () => {
  const english = navigationFor(en.nav);
  const hrefs = (n: typeof navigation) => n.flatMap((e) => (e.href ? [e.href] : (e.links ?? []).map((l) => l.href)));
  expect(hrefs(english)).toEqual(hrefs(navigation));
  expect(english.map((e) => e.label)).toEqual(["Countries", "Study", "Work & Visas", "Compare", "Evidence"]);
});
