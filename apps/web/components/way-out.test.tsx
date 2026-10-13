import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { WayOut } from "./way-out";

// UX review 2026-10-13 (L6): an empty state always offers somewhere to go.
it("offers the country's official sources and the countries with data by default", () => {
  const html = renderToStaticMarkup(<WayOut country="norway" />);
  expect(html).toContain('href="/sources?country=norway"');
  expect(html).toContain("Nguồn chính thức của Na Uy");
  expect(html).toContain('href="/countries"');
  expect(html).not.toContain("Bỏ bộ lọc");
});
it("adds 'clear filters' only when filters are active, and all sources without a country", () => {
  const html = renderToStaticMarkup(<WayOut clearHref="/programmes" />);
  expect(html).toContain('href="/programmes"');
  expect(html).toContain("Bỏ bộ lọc");
  expect(html).toContain('href="/sources"');
});
it("puts the item's own official page first on detail pages, opening in a new tab, in English too", () => {
  const html = renderToStaticMarkup(<WayOut official="https://uni.example.test/msc" country="sweden" locale="en" />);
  expect(html.indexOf("https://uni.example.test/msc")).toBeLessThan(html.indexOf("/sources?country=sweden"));
  expect(html).toContain('target="_blank"');
  expect(html).toContain("Official sources for Sweden");
  expect(html).not.toContain('href="/countries"');
});
