import { load, type CheerioAPI } from "cheerio";
import { LIMITS } from "./config";

/** A selection of nodes, typed from cheerio itself (no direct domhandler dependency). */
export type Selection = ReturnType<CheerioAPI>;

// Elements that never carry the page's own content.
export const NOISE = "script, style, noscript, svg, template, iframe, nav, footer, header, form, button, [aria-hidden='true']";
const BLOCKS = "p, li, h1, h2, h3, h4, h5, h6, tr, dt, dd, blockquote, pre, section, article, div, br";

/**
 * The part of the page that is read, shared by the readable text and the
 * structured snapshot (PR 1) so both describe the same content: the
 * registered CSS selector when it matches, else main, article or body.
 * Call after removing NOISE (and anything else the caller must ignore).
 */
export function contentRoot($: CheerioAPI, selector?: string | null): { root: Selection; kind: "selector" | "main" | "article" | "body" } {
  if (selector && $(selector).first().length) return { root: $(selector).first(), kind: "selector" };
  if ($("main").first().length) return { root: $("main").first(), kind: "main" };
  if ($("article").first().length) return { root: $("article").first(), kind: "article" };
  return { root: $("body"), kind: "body" };
}

/**
 * Title and readable text of an HTML page. Text keeps block boundaries as
 * newlines so excerpts stay recognisable; the hash later normalises spacing.
 * Output is pinned by extract.baseline.test.ts (sha256-text-v1): do not change
 * it without versioning the hash method.
 */
export function extractPage(html: string, selector?: string | null) {
  const $ = load(html);
  const title = ($("title").first().text() || $("h1").first().text()).replace(/\s+/g, " ").trim() || null;
  $(NOISE).remove();
  const { root } = contentRoot($, selector);
  root.find(BLOCKS).each((_, el) => { $(el).append("\n"); });
  const text = root.text().split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n").slice(0, LIMITS.maxTextChars);
  return { title: title ? title.slice(0, 300) : null, text };
}
