import { expect, it } from "vitest";
import { sitemapUrls } from "./sitemap";

const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://agency.example.test/study/a</loc></url><url><loc>https://agency.example.test/study/a#top</loc></url>
<url><loc>https://agency.example.test/work/b</loc></url><url><loc>https://evil.example.test/study/c</loc></url>
<url><loc>https://agency.example.test/study/d</loc></url><url><loc>javascript:alert(1)</loc></url></urlset>`;

it("keeps only same-origin URLs under the registered prefix, de-duplicated and capped", () => {
  expect(sitemapUrls(xml, "https://agency.example.test/", "/study/", 10).urls).toEqual(["https://agency.example.test/study/a", "https://agency.example.test/study/d"]);
  expect(sitemapUrls(xml, "https://agency.example.test/", "/study/", 1).urls).toHaveLength(1);
  expect(sitemapUrls(xml, "https://agency.example.test/", null, 10).urls).toHaveLength(3);
});
it("does not follow sitemap indexes (no discovery beyond what was registered)", () => {
  const index = `<sitemapindex><sitemap><loc>https://agency.example.test/more.xml</loc></sitemap></sitemapindex>`;
  expect(sitemapUrls(index, "https://agency.example.test/", null, 10)).toEqual({ urls: [], index: true });
});
