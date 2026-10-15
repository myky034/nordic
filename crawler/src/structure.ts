import { load, type CheerioAPI } from "cheerio";
import { contentRoot, NOISE } from "./extract";
import { canonical, sameOrigin } from "./urls";

// PR 1 (docs/architecture/pr1-structured-content-plan.md, approved 2026-10-15):
// a structured snapshot of the rendered page, stored NEXT TO the readable
// text (document_texts, unchanged). Pure and deterministic: the same visible
// content always gives the same JSON (no timestamps, ids, classes or styles),
// so the database's structure hash only changes when the page really does.

export const STRUCTURE_FORMAT = "html-structure-v1" as const;

type Ref = string;
type DomPath = string;
type Section = string[];
export type StructureBlockKind = "p" | "li" | "dd" | "blockquote" | "pre" | "summary" | "text";
export type DocumentStructure = {
  formatVersion: typeof STRUCTURE_FORMAT;
  title: string | null;
  lang: string | null;
  canonicalUrl: string | null;
  root: { kind: "selector" | "main" | "article" | "body"; selector: string | null };
  headings: { ref: Ref; domPath: DomPath; level: number; text: string; section: Section }[];
  blocks: { ref: Ref; domPath: DomPath; kind: StructureBlockKind; text: string; section: Section; depth?: number }[];
  pairs: { ref: Ref; domPath: DomPath; label: string; value: string; section: Section; from: "dl" | "th_row" | "label_value"; labelPath: DomPath; valuePath: DomPath }[];
  tables: { ref: Ref; domPath: DomPath; section: Section; caption: string | null; headers: string[]; rows: { cells: string[] }[] }[];
  links: { ref: Ref; domPath: DomPath; text: string; href: string; sameOrigin: boolean; fileType: "pdf" | "doc" | null; section: Section }[];
  // Extension point (review item 2): one entry per approved adapter. PR 1 has
  // only json-ld; arbitrary script state is never read.
  structuredData: { adapter: "json-ld"; adapterVersion: 1; items: unknown[] }[];
  limits: { truncated: boolean; dropped: Partial<Record<"blocks" | "pairs" | "tables" | "links" | "structuredData" | "rows" | "cells", number>> };
};

export const STRUCTURE_LIMITS = {
  blocks: 1000, pairs: 300, tables: 50, rows: 200, cells: 20, links: 500, structuredData: 20,
  chars: 2000, labelChars: 60, bytes: 1_000_000,
} as const;

const BLOCK_TAGS = new Set(["p", "li", "dd", "blockquote", "pre", "summary"]);
const HEADING = /^h([1-6])$/;
// Containers handled as a whole elsewhere: their insides are not blocks.
const OWN_HANDLING = new Set(["table", "dl"]);
// Inline elements: text inside them belongs to the enclosing block.
const INLINE = new Set(["a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "dfn", "em", "i", "kbd", "label", "mark", "q", "s", "samp",
  "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr", "img", "input"]);
// Two children of these kinds are siblings in a list or a control, not a label and its value.
const NOT_PAIR_PARENT = new Set(["ul", "ol", "menu", "select", "datalist", "tr", "thead", "tbody", "nav"]);
const NOT_PAIR_CHILD = new Set(["li", "option", "label", "input", "button", "img", "a"]);
// Sectioning elements scope headings: a heading inside does not label what follows outside.
const SECTIONING = new Set(["section", "article", "aside"]);
// Query parameters that change between visits without changing the target.
const VOLATILE_PARAMS = /^(utm_[a-z]+|fbclid|gclid|mc_eid|jsessionid)$/i;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const clip = (s: string, n: number = STRUCTURE_LIMITS.chars) => (s.length > n ? s.slice(0, n) : s);
type Node = Parameters<CheerioAPI>[0];
type El = { type: string; name?: string; parent?: El | null; children?: El[]; data?: string; attribs?: Record<string, string> };

/** Stable link target: absolute, same rules as crawl URLs, without fragments or volatile tracking/session parameters. */
export function normaliseHref(href: string, pageUrl: string): string | null {
  let url: URL;
  try { url = new URL(href, pageUrl); } catch { return null; }
  url.pathname = url.pathname.replace(/;jsessionid=[^/]*/i, "");
  for (const key of [...url.searchParams.keys()]) if (VOLATILE_PARAMS.test(key)) url.searchParams.delete(key);
  return canonical(url.toString());
}

/**
 * Structured snapshot of a page. `selector` and the removed noise are the
 * same as for the readable text (extract.ts), so both describe one region.
 */
export function extractStructure(html: string, selector: string | null | undefined, pageUrl: string): DocumentStructure {
  const $ = load(html);
  const title = clip(clean($("title").first().text() || $("h1").first().text()), 300) || null;
  const lang = clean($("html").attr("lang") ?? "") || null;
  const canonicalHref = $("link[rel='canonical']").attr("href");
  const canonicalUrl = canonicalHref ? normaliseHref(canonicalHref, pageUrl) : null;
  const dropped: DocumentStructure["limits"]["dropped"] = {};
  const drop = (k: keyof DocumentStructure["limits"]["dropped"], n = 1) => { dropped[k] = (dropped[k] ?? 0) + n; };

  // JSON-LD is read BEFORE scripts are removed; any other script content never is.
  const jsonLd: unknown[] = [];
  $("script[type='application/ld+json']").each((_, el) => {
    let parsed: unknown;
    try { parsed = JSON.parse($(el).text()); } catch { return; } // malformed JSON-LD is skipped, never fatal
    for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
      if (jsonLd.length < STRUCTURE_LIMITS.structuredData) jsonLd.push(item); else drop("structuredData");
    }
  });

  $(NOISE).remove();
  const { root, kind } = contentRoot($, selector);
  const rootEl = root.get(0) as unknown as El | undefined;
  const out: DocumentStructure = {
    formatVersion: STRUCTURE_FORMAT, title, lang, canonicalUrl: canonicalUrl && sameOrigin(canonicalUrl, pageUrl) ? canonicalUrl : null,
    root: { kind, selector: kind === "selector" ? selector ?? null : null },
    headings: [], blocks: [], pairs: [], tables: [], links: [],
    structuredData: jsonLd.length ? [{ adapter: "json-ld", adapterVersion: 1, items: jsonLd }] : [],
    limits: { truncated: false, dropped },
  };
  if (!rootEl) return out;

  const counters = { h: 0, b: 0, p: 0, t: 0, l: 0 };
  const ref = (k: keyof typeof counters) => `${k}${++counters[k]}`;
  // Visible words with a space at element boundaries ("<span>Beginning/End</span><span>week…"
  // reads "Beginning/End week…", not run together as in the flat text), without
  // a space before closing punctuation.
  // A <br> keeps its line break: lines such as "15 January: Last day to apply"
  // stay separate (KTH deadline lists, found on the real page 2026-10-15).
  // Source-code line breaks are plain whitespace (HTML collapses them); only
  // <br>, or text inside <pre>, makes a new line. Otherwise re-indenting the
  // page's HTML would change the structure and its hash.
  const piece = (k: El, pre: boolean): string => k.type === "text" ? (pre ? k.data ?? "" : (k.data ?? "").replace(/\s+/g, " "))
    : tag(k) === "br" ? "\n" : k.type === "tag" ? ` ${words(k, pre || tag(k) === "pre")} ` : "";
  const words = (el: El, pre = tag(el) === "pre"): string => (el.children ?? []).map((k) => piece(k, pre)).join("");
  const tidyLine = (line: string) => clean(line).replace(/\s+([.,;:!?)\]])/g, "$1").replace(/([(\[])\s+/g, "$1");
  const tidy = (raw: string) => clip(raw.split("\n").map(tidyLine).filter(Boolean).join("\n"));
  const text = (el: El) => tidy(words(el));
  const tag = (el: El) => (el.type === "tag" || el.type === "script" || el.type === "style" ? el.name ?? "" : "");
  // Readable, structural path from the read region (tag + position among same-tag siblings);
  // never classes or ids, which change between visits.
  const pathCache = new Map<El, string>();
  const domPath = (el: El): string => {
    if (el === rootEl) return kind === "selector" ? `${selector}` : tag(el);
    const cached = pathCache.get(el);
    if (cached) return cached;
    const parent = el.parent as El;
    const same = (parent.children ?? []).filter((c) => tag(c) === tag(el));
    const p = `${domPath(parent)}>${tag(el)}:nth-of-type(${same.indexOf(el) + 1})`;
    pathCache.set(el, p);
    return p;
  };
  const headings: { level: number; text: string }[] = [];
  const section = () => headings.map((h) => h.text);
  const hasBlockDescendant = (el: El): boolean => (el.children ?? []).some((c) => c.type === "tag" && (!INLINE.has(tag(c)) || hasBlockDescendant(c)));
  const listDepth = (el: El) => { let d = 0; for (let p = el.parent; p && p !== rootEl; p = p.parent) if (["ul", "ol"].includes(tag(p))) d++; return Math.max(0, d - 1); };
  // A label is short, has no digits (not "Application opens 16 October 2026"),
  // does not end a sentence and is not itself "Label: value".
  const isLabel = (t: string) => t.length > 0 && t.length <= STRUCTURE_LIMITS.labelChars && !/\d/.test(t) && !/[.;!?]$/.test(t) && !/:\s*\S/.test(t);
  const pushBlock = (b: Omit<DocumentStructure["blocks"][number], "ref">) => {
    if (!b.text) return;
    if (out.blocks.length >= STRUCTURE_LIMITS.blocks) { drop("blocks"); return; }
    out.blocks.push({ ref: ref("b"), ...b });
  };
  const pushPair = (p: Omit<DocumentStructure["pairs"][number], "ref">) => {
    if (!p.label || !p.value) return;
    if (out.pairs.length >= STRUCTURE_LIMITS.pairs) { drop("pairs"); return; }
    out.pairs.push({ ref: ref("p"), ...p });
  };

  const readTable = (el: El) => {
    if (out.tables.length >= STRUCTURE_LIMITS.tables) { drop("tables"); return; }
    const $t = $(el as unknown as Node);
    const rows = $t.find("tr").toArray().filter((tr) => $(tr).closest("table").get(0) === (el as unknown)) as unknown as El[];
    const cellsOf = (tr: El) => (tr.children ?? []).filter((c) => ["td", "th"].includes(tag(c)));
    let headers: string[] = [];
    let body = rows;
    const first = rows[0];
    if (first && (tag(first.parent as El) === "thead" || (cellsOf(first).length > 1 && cellsOf(first).every((c) => tag(c) === "th")))) {
      headers = cellsOf(first).map(text).slice(0, STRUCTURE_LIMITS.cells);
      body = rows.slice(1);
    }
    if (body.length > STRUCTURE_LIMITS.rows) drop("rows", body.length - STRUCTURE_LIMITS.rows);
    const tableRows = body.slice(0, STRUCTURE_LIMITS.rows).map((tr) => {
      const cells = cellsOf(tr);
      if (cells.length > STRUCTURE_LIMITS.cells) drop("cells", cells.length - STRUCTURE_LIMITS.cells);
      // A row with one <th> followed by <td>s is a label/value pair as well.
      if (tag(cells[0]) === "th" && cells.length > 1 && cells.slice(1).every((c) => tag(c) === "td")) {
        pushPair({ domPath: domPath(tr), label: text(cells[0]), value: cells.slice(1).map(text).join(" | "), section: section(), from: "th_row",
          labelPath: domPath(cells[0]), valuePath: domPath(cells[1]) });
      }
      return { cells: cells.slice(0, STRUCTURE_LIMITS.cells).map(text) };
    });
    out.tables.push({ ref: ref("t"), domPath: domPath(el), section: section(), caption: clip(clean($t.children("caption").first().text())) || null, headers, rows: tableRows });
  };

  const readDl = (el: El) => {
    let label: El | null = null;
    let values: El[] = [];
    const flush = () => {
      if (label && values.length) pushPair({ domPath: domPath(label), label: text(label), value: values.map(text).join("\n"), section: section(), from: "dl", labelPath: domPath(label), valuePath: domPath(values[0]) });
      values = [];
    };
    for (const c of el.children ?? []) {
      if (tag(c) === "dt") { flush(); label = c; }
      else if (tag(c) === "dd") values.push(c);
    }
    flush();
  };

  const walk = (el: El) => {
    // Loose text and inline elements between blocks ("<span>Tuition fee</span>" next
    // to a <p>) are visible words too: each run becomes one text block.
    let run: El[] = [];
    const flush = () => {
      const t = tidy(run.map((k) => piece(k, false)).join(""));
      const first = run.find((k) => k.type === "tag");
      if (t) pushBlock({ domPath: first ? domPath(first) : domPath(el), kind: "text", text: t, section: section() });
      run = [];
    };
    for (const c of el.children ?? []) {
      if (c.type === "text") { run.push(c); continue; }
      if (c.type !== "tag") continue;
      const name = tag(c);
      if (INLINE.has(name) && !hasBlockDescendant(c)) {
        run.push(c);
        if (name === "a") pushLink(c); else collectLinks(c);
        continue;
      }
      flush();
      if (name === "a") pushLink(c);
      const heading = name.match(HEADING);
      if (heading) {
        const level = Number(heading[1]);
        while (headings.length && headings[headings.length - 1].level >= level) headings.pop();
        const t = text(c);
        if (t) { out.headings.push({ ref: ref("h"), domPath: domPath(c), level, text: t, section: section() }); headings.push({ level, text: t }); }
        continue;
      }
      if (name === "table") { readTable(c); collectLinks(c); continue; }
      if (name === "dl") { readDl(c); collectLinks(c); continue; }
      if (BLOCK_TAGS.has(name)) {
        // A list item's own text excludes nested lists, which become their own blocks.
        const own = name === "li" ? text({ ...c, children: (c.children ?? []).filter((k) => !["ul", "ol"].includes(tag(k))) }) : text(c);
        pushBlock({ domPath: domPath(c), kind: name as StructureBlockKind, text: own, section: section(), ...(name === "li" ? { depth: listDepth(c) } : {}) });
        // A list item was read as one block: only its nested lists are walked
        // (they become their own items); its links are listed.
        if (name === "li") for (const k of c.children ?? []) { if (["ul", "ol"].includes(tag(k))) walk(k); else if (tag(k) === "a") pushLink(k); else if (k.type === "tag") collectLinks(k); }
        else collectLinks(c);
        continue;
      }
      // A short label element followed by its value element (trailing links
      // allowed, as in "<span>Tuition fee</span><p>…</p><a>More information</a>").
      const kids = (c.children ?? []).filter((k) => k.type === "tag" && tag(k) !== "br");
      const loose = (c.children ?? []).some((k) => k.type === "text" && clean(k.data ?? ""));
      if (kids.length >= 2 && !loose && !NOT_PAIR_PARENT.has(name) && kids.slice(2).every((k) => tag(k) === "a")
          && !kids.slice(0, 2).some((k) => OWN_HANDLING.has(tag(k)) || NOT_PAIR_CHILD.has(tag(k)) || HEADING.test(tag(k)))) {
        const label = text(kids[0]), value = text(kids[1]);
        if (isLabel(label) && value) {
          pushPair({ domPath: domPath(c), label: label.replace(/:$/, ""), value, section: section(), from: "label_value", labelPath: domPath(kids[0]), valuePath: domPath(kids[1]) });
        }
      }
      if (!INLINE.has(name) && !hasBlockDescendant(c)) {
        pushBlock({ domPath: domPath(c), kind: "text", text: text(c), section: section() });
        collectLinks(c);
        continue;
      }
      if (SECTIONING.has(name)) {
        // Headings found inside stay inside; an <aside> (sidebar) is outside the
        // body's subsections and keeps only the page-level (h1) heading.
        const saved = headings.splice(0);
        if (name === "aside") headings.push(...saved.filter((h) => h.level === 1)); else headings.push(...saved);
        walk(c);
        headings.splice(0, headings.length, ...saved);
        continue;
      }
      walk(c);
    }
    flush();
  };
  // Every link once, in document order, wherever it sits.
  const seenLinks = new Set<El>();
  const pushLink = (a: El) => {
    if (seenLinks.has(a)) return;
    seenLinks.add(a);
    const href = a.attribs?.href ? normaliseHref(a.attribs.href, pageUrl) : null;
    if (!href) return;
    if (out.links.length >= STRUCTURE_LIMITS.links) { drop("links"); return; }
    const path = new URL(href).pathname;
    out.links.push({ ref: ref("l"), domPath: domPath(a), text: text(a), href, sameOrigin: sameOrigin(href, pageUrl),
      fileType: /\.pdf$/i.test(path) ? "pdf" : /\.docx?$/i.test(path) ? "doc" : null, section: section() });
  };
  const collectLinks = (el: El) => { $(el as unknown as Node).find("a").each((_, a) => pushLink(a as unknown as El)); };
  walk(rootEl);

  // Hard size cap: halve the longest lists until it fits, never silently.
  while (Buffer.byteLength(JSON.stringify(out), "utf8") > STRUCTURE_LIMITS.bytes) {
    const longest = (["blocks", "links", "pairs", "tables"] as const).reduce((a, b) => (out[a].length >= out[b].length ? a : b));
    if (out[longest].length === 0) {
      // Only metadata / JSON-LD left: drop JSON-LD; if still too large, stop (the database rejects it, recorded as an error).
      if (!out.structuredData.length) break;
      drop("structuredData", out.structuredData[0].items.length); out.structuredData = []; continue;
    }
    const keep = Math.floor(out[longest].length / 2);
    drop(longest, out[longest].length - keep);
    out[longest].length = keep;
  }
  out.limits.truncated = Object.keys(dropped).length > 0;
  return out;
}
