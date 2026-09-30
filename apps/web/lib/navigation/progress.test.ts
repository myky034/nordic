import { expect, it } from "vitest";
import { startsNavigation, type ClickInfo } from "./progress";

const here = "http://localhost:3000/admin/access?tab=roles";
const click = (over: Partial<ClickInfo>): ClickInfo => ({ href: "/admin/access?tab=roles&role=r1", target: null, download: false, button: 0, modified: false, ...over });

it("starts for a plain left click to another page or query of this site", () => {
  expect(startsNavigation(click({}), here)).toBe(true);
  expect(startsNavigation(click({ href: "/dashboard" }), here)).toBe(true);
});
it("ignores new tabs, other buttons, downloads, other sites and hash jumps", () => {
  expect(startsNavigation(click({ modified: true }), here)).toBe(false);
  expect(startsNavigation(click({ button: 1 }), here)).toBe(false);
  expect(startsNavigation(click({ target: "_blank" }), here)).toBe(false);
  expect(startsNavigation(click({ download: true }), here)).toBe(false);
  expect(startsNavigation(click({ href: "https://www.migrationsverket.se/" }), here)).toBe(false);
  expect(startsNavigation(click({ href: "/admin/access?tab=roles#top" }), here)).toBe(false);
  expect(startsNavigation(click({ href: "mailto:someone@example.test" }), here)).toBe(false);
  expect(startsNavigation(click({ href: null }), here)).toBe(false);
});
