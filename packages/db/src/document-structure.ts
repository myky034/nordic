// Shared contract of the structured page snapshot (PR 1, format
// "html-structure-v1"): written by the crawler (crawler/src/structure.ts) into
// document_structures, read by the admin preview (PR 1.5). One definition, so
// writer and reader cannot drift. A new format gets a new version string.
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


const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const strArr = (v: unknown) => Array.isArray(v) && v.every(isStr);
const items = (v: unknown, ok: (x: Record<string, unknown>) => boolean) => Array.isArray(v) && v.every((x) => isObj(x) && ok(x));
const traced = (x: Record<string, unknown>) => isStr(x.ref) && isStr(x.domPath) && strArr(x.section);

/**
 * Shape check before display: data read from the database is never trusted
 * blindly. Returns false for any other format or a malformed snapshot; the
 * preview then shows the raw JSON with a warning instead of failing.
 */
export function isStructureV1(v: unknown): v is DocumentStructure {
  if (!isObj(v) || v.formatVersion !== STRUCTURE_FORMAT) return false;
  if (!isObj(v.root) || !isObj(v.limits) || typeof v.limits.truncated !== "boolean") return false;
  return items(v.headings, (x) => traced(x) && typeof x.level === "number" && isStr(x.text))
    && items(v.blocks, (x) => traced(x) && isStr(x.kind) && isStr(x.text))
    && items(v.pairs, (x) => traced(x) && isStr(x.label) && isStr(x.value) && isStr(x.from))
    && items(v.tables, (x) => traced(x) && strArr(x.headers) && items(x.rows, (r) => strArr(r.cells)))
    && items(v.links, (x) => traced(x) && isStr(x.href) && isStr(x.text) && typeof x.sameOrigin === "boolean")
    && items(v.structuredData, (x) => isStr(x.adapter) && Array.isArray(x.items));
}
