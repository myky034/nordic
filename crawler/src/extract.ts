import { load } from "cheerio";
import { LIMITS } from "./config";

// Elements that never carry the page's own content.
const NOISE = "script, style, noscript, svg, template, iframe, nav, footer, header, form, button, [aria-hidden='true']";
const BLOCKS = "p, li, h1, h2, h3, h4, h5, h6, tr, dt, dd, blockquote, pre, section, article, div, br";

/**
 * Title and readable text of an HTML page. Text keeps block boundaries as
 * newlines so excerpts stay recognisable; the hash later normalises spacing.
 */
export function extractPage(html: string, selector?: string | null) {
  const $ = load(html);
  const title = ($("title").first().text() || $("h1").first().text()).replace(/\s+/g, " ").trim() || null;
  $(NOISE).remove();
  const root = (selector && $(selector).first().length ? $(selector).first() : null)
    ?? ($("main").first().length ? $("main").first() : $("article").first().length ? $("article").first() : $("body"));
  root.find(BLOCKS).each((_, el) => { $(el).append("\n"); });
  const text = root.text().split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n").slice(0, LIMITS.maxTextChars);
  return { title: title ? title.slice(0, 300) : null, text };
}
