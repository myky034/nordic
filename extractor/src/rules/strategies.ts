import type { DocumentStructure } from "@nordic/db/document-structure";
import type { JsonPath } from "@nordic/db/rule-output";
import type { Rule, Strategy } from "./types";

// PR 2b (review §5.2–§5.4): where a value is found in a structure snapshot.
// Strategies read the snapshot only (no HTML, no CSS / XPath after the crawl).
// Every hit names exactly one element and one of its strings, and the value
// is a substring of that string, so the evidence can be checked later
// (contract review §3.3). Hits come back in document order.

export type Hit = {
  ref: string;
  field: "text" | "label" | "value" | "canonical" | "cell" | "json_ld";
  cell?: readonly [number, number];
  /** For field "json_ld": keys / indexes from the item to the value. */
  path?: JsonPath;
  /** The verbatim part of the element's string that supports the value. */
  excerpt: string;
  /** What the normalizer reads (a capture group `value`, or the excerpt). */
  value: string;
  /** Heading path of the element (for intake headings). */
  section: readonly string[];
  /** Position for a stable order: kind rank, then index in that list. */
  order: [number, number];
};

const RANK = { headings: 0, blocks: 1, pairs: 2, tables: 3, links: 4, structuredData: 5 } as const;
const nearest = (section: readonly string[]) => section[section.length - 1] ?? "";
const sameLabel = (a: string, b: string) => a.trim().replace(/:$/, "").toLowerCase() === b.trim().toLowerCase();
const startsWith = (section: readonly string[], prefix: readonly string[]) => prefix.every((p, i) => section[i] === p);
/** A fresh global copy: matchAll needs `g`, and rules may not carry it (no shared lastIndex). */
const all = (re: RegExp, text: string) => [...text.matchAll(new RegExp(re.source, `${re.flags}g`))];

/** The excerpt is the whole match; the value is the `value` group when the rule has one. */
const piece = (m: RegExpMatchArray) => ({ excerpt: m[0], value: m.groups?.value ?? m[0] });

export function findHits(s: DocumentStructure, strategy: Strategy, evidence: Rule["evidence"]): Hit[] {
  switch (strategy.kind) {
    case "pair":
      return s.pairs.flatMap((p, i) => {
        if (!strategy.labels.some((l) => sameLabel(p.label, l))) return [];
        if (strategy.section && !startsWith(p.section, strategy.section)) return [];
        const field = evidence === "label" || evidence === "canonical" ? evidence : "value";
        const excerpt = field === "canonical" ? `${p.label}: ${p.value}` : field === "label" ? p.label : p.value;
        return [{ ref: p.ref, field, excerpt, value: p.value, section: p.section, order: [RANK.pairs, i] as [number, number] }];
      });
    case "section_lines":
      // Lines of one block under the heading; "\n" in a block is a <br> or <pre> line (PR 1).
      return s.blocks.flatMap((b, i) => {
        if (!strategy.heading.test(nearest(b.section))) return [];
        return b.text.split("\n").flatMap((line) => {
          const m = strategy.line.exec(line.trim());
          return m ? [{ ref: b.ref, field: "text" as const, ...piece(m), section: b.section, order: [RANK.blocks, i] as [number, number] }] : [];
        });
      });
    case "sentence":
      return s.blocks.flatMap((b, i) => {
        if (strategy.heading && !strategy.heading.test(nearest(b.section))) return [];
        return all(strategy.pattern, b.text).map((m) => ({ ref: b.ref, field: "text" as const, ...piece(m), section: b.section, order: [RANK.blocks, i] as [number, number] }));
      });
    case "table":
      return s.tables.flatMap((t, i) => {
        const column = t.headers.findIndex((h) => sameLabel(h, strategy.columnHeader));
        if (column < 0) return [];
        return t.rows.flatMap((r, row) => {
          if (strategy.rowLabel !== undefined && !sameLabel(r.cells[0] ?? "", strategy.rowLabel)) return [];
          const cell = r.cells[column];
          return cell?.trim() ? [{ ref: t.ref, field: "cell" as const, cell: [row, column] as const, excerpt: cell, value: cell, section: t.section, order: [RANK.tables, i] as [number, number] }] : [];
        });
      });
    case "json_ld":
      // JSON-LD items have no element ref in html-structure-v1: "sd<adapter>.<item>"
      // names the item and `path` the property (PR #6 review M5), so the
      // evidence points at exactly one value, which elementString() re-reads.
      return s.structuredData.flatMap((d, a) => d.items.flatMap((item, n) => {
        if (!hasType(item, strategy.type)) return [];
        const value = valueAt(item, strategy.path);
        return value === null ? [] : [{ ref: `sd${a}.${n}`, field: "json_ld" as const, path: [...strategy.path], excerpt: value, value, section: [], order: [RANK.structuredData, a * 1000 + n] as [number, number] }];
      }));
  }
}

function hasType(item: unknown, type: string) {
  const t = item && typeof item === "object" ? (item as Record<string, unknown>)["@type"] : undefined;
  return t === type || (Array.isArray(t) && t.includes(type));
}

/** The string or number at `path` inside a JSON value, or null (missing path, wrong kind, empty). */
function valueAt(item: unknown, path: JsonPath): string | null {
  let v: unknown = item;
  for (const key of path) {
    if (typeof key === "number") v = Array.isArray(v) ? v[key] : undefined;
    else v = v && typeof v === "object" && !Array.isArray(v) && Object.hasOwn(v, key) ? (v as Record<string, unknown>)[key] : undefined;
  }
  return typeof v === "string" && v.trim() ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : null;
}

/** The one string of one element a hit points to (review §3.3), or null if there is none. */
export function elementString(s: DocumentStructure, hit: Pick<Hit, "ref" | "field" | "cell" | "path">): string | null {
  if (hit.field === "json_ld") {
    const sd = /^sd(\d+)\.(\d+)$/.exec(hit.ref);
    const item = sd ? s.structuredData[+sd[1]]?.items[+sd[2]] : undefined;
    return item === undefined || !hit.path?.length ? null : valueAt(item, hit.path);
  }
  if (hit.field === "cell") {
    const t = s.tables.find((x) => x.ref === hit.ref);
    return hit.cell ? t?.rows[hit.cell[0]]?.cells[hit.cell[1]] ?? null : null;
  }
  const p = s.pairs.find((x) => x.ref === hit.ref);
  if (p) return hit.field === "label" ? p.label : hit.field === "value" ? p.value : hit.field === "canonical" ? `${p.label}: ${p.value}` : null;
  if (hit.field !== "text") return null;
  return [...s.headings, ...s.blocks, ...s.links].find((x) => x.ref === hit.ref)?.text ?? null;
}
