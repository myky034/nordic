import { load } from "cheerio";
import { canonical, sameOrigin } from "./urls";

/**
 * URLs listed in a <urlset> sitemap, kept only when on the source's origin and
 * under the registered path prefix, de-duplicated, capped at `max`.
 * Sitemap indexes are not followed (no discovery beyond what was registered).
 */
export function sitemapUrls(xml: string, sourceUrl: string, prefix: string | null, max: number) {
  const $ = load(xml, { xml: true });
  if ($("sitemapindex").length) return { urls: [] as string[], index: true };
  const out: string[] = [];
  $("url > loc").each((_, el) => {
    const url = canonical($(el).text().trim());
    if (!url || !sameOrigin(url, sourceUrl)) return;
    if (prefix && !new URL(url).pathname.startsWith(prefix)) return;
    if (!out.includes(url) && out.length < max) out.push(url);
  });
  return { urls: out, index: false };
}
