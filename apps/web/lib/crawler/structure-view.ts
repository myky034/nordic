import type { DocumentStructure } from "@nordic/db/document-structure";

// PR 1.5 (docs/architecture/pr1.5-structure-preview-plan.md): pure helpers of the
// read-only structure preview — who may open it, which of the three states a
// document is in, filtering, and a comparison by CONTENT (labels, hrefs, text),
// never by ref/domPath, which are only stable inside one snapshot.

/** Permissions under which document_structures is readable (RLS policy document_structures_editors). */
export const STRUCTURE_READ_PERMISSIONS = ["facts.propose", "facts.review", "documents.ingest"] as const;

/** Opening the page: crawler operators, or anyone the structure RLS lets read. Data is still decided by RLS. */
export const canOpenPreview = (permissions: readonly string[]) =>
  permissions.includes("crawler.manage") || STRUCTURE_READ_PERMISSIONS.some((p) => permissions.includes(p));
export const canReadStructures = (permissions: readonly string[]) => STRUCTURE_READ_PERMISSIONS.some((p) => permissions.includes(p));

export type PreviewState = "not_crawled" | "no_access" | "missing" | "available";
/**
 * The three states the review asked to keep apart, plus "no access":
 * - not_crawled: the document was not fetched by the crawler (manual / API import);
 * - no_access: the viewer may open the page but RLS hides structures from them;
 * - missing: a crawler document without any snapshot (crawled before PR 1, or the save failed);
 * - available: at least one snapshot.
 */
export function previewState(input: { ingestionMethod: string; canRead: boolean; snapshotCount: number }): PreviewState {
  if (input.ingestionMethod !== "crawler") return "not_crawled";
  if (!input.canRead) return "no_access";
  return input.snapshotCount > 0 ? "available" : "missing";
}

export const shortHash = (hash: string) => (hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash);
export const sectionLabel = (section: readonly string[]) => section.join(" › ");

/** Every section path used by the snapshot, in first-seen order (for the section filter). */
export function sectionsOf(s: DocumentStructure): string[] {
  const out: string[] = [];
  for (const e of [...s.headings, ...s.blocks, ...s.pairs, ...s.tables, ...s.links]) {
    const label = sectionLabel(e.section);
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

const has = (q: string, ...fields: (string | null | undefined)[]) => fields.some((f) => f?.toLowerCase().includes(q));
/**
 * Text filter (case-insensitive, on label, value, text, href, cells) and
 * section filter (an element matches a section when that path is its own
 * section or an ancestor of it). Original order is kept.
 */
export function filterStructure(s: DocumentStructure, opts: { q?: string; section?: string }): DocumentStructure {
  const q = (opts.q ?? "").trim().toLowerCase();
  const inSection = (section: readonly string[]) => !opts.section || sectionLabel(section) === opts.section || sectionLabel(section).startsWith(`${opts.section} › `);
  return {
    ...s,
    headings: s.headings.filter((h) => inSection(h.section) && (!q || has(q, h.text))),
    blocks: s.blocks.filter((b) => inSection(b.section) && (!q || has(q, b.text))),
    pairs: s.pairs.filter((p) => inSection(p.section) && (!q || has(q, p.label, p.value))),
    tables: s.tables.filter((t) => inSection(t.section) && (!q || has(q, t.caption, ...t.headers, ...t.rows.flatMap((r) => r.cells)))),
    links: s.links.filter((l) => inSection(l.section) && (!q || has(q, l.text, l.href))),
  };
}

export type StructureDiff = {
  pairs: { added: DocumentStructure["pairs"]; removed: DocumentStructure["pairs"]; changed: { label: string; section: string[]; before: string; after: string }[] };
  headings: { added: string[]; removed: string[] };
  links: { added: DocumentStructure["links"]; removed: DocumentStructure["links"] };
  blocks: { added: string[]; removed: string[] };
  same: boolean;
};
const counts = (keys: string[]) => keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>());
/** Multiset difference: items of `a` not matched in `b` (repeated texts are counted, not collapsed). */
function minus<T>(a: T[], b: T[], key: (x: T) => string): T[] {
  const left = counts(b.map(key));
  return a.filter((x) => { const k = key(x), n = left.get(k) ?? 0; if (n > 0) { left.set(k, n - 1); return false; } return true; });
}
/**
 * Compares two snapshots by content: pairs by section + label (value changes
 * reported as "changed"), headings by level + text, links by href + text,
 * blocks by text. ref and domPath are ignored on purpose.
 */
export function diffStructures(before: DocumentStructure, after: DocumentStructure): StructureDiff {
  const pairKey = (p: DocumentStructure["pairs"][number]) => `${sectionLabel(p.section)}::${p.label}`;
  const oldPairs = new Map(before.pairs.map((p) => [pairKey(p), p]));
  const newPairs = new Map(after.pairs.map((p) => [pairKey(p), p]));
  const changed = [...newPairs].filter(([k, p]) => oldPairs.has(k) && oldPairs.get(k)!.value !== p.value)
    .map(([k, p]) => ({ label: p.label, section: p.section, before: oldPairs.get(k)!.value, after: p.value }));
  const headingKey = (h: DocumentStructure["headings"][number]) => `h${h.level} ${h.text}`;
  const linkKey = (l: DocumentStructure["links"][number]) => `${l.href} ${l.text}`;
  const diff: StructureDiff = {
    pairs: { added: after.pairs.filter((p) => !oldPairs.has(pairKey(p))), removed: before.pairs.filter((p) => !newPairs.has(pairKey(p))), changed },
    headings: { added: minus(after.headings, before.headings, headingKey).map(headingKey), removed: minus(before.headings, after.headings, headingKey).map(headingKey) },
    links: { added: minus(after.links, before.links, linkKey), removed: minus(before.links, after.links, linkKey) },
    blocks: { added: minus(after.blocks, before.blocks, (b) => b.text).map((b) => b.text), removed: minus(before.blocks, after.blocks, (b) => b.text).map((b) => b.text) },
    same: false,
  };
  diff.same = !diff.pairs.added.length && !diff.pairs.removed.length && !diff.pairs.changed.length && !diff.headings.added.length && !diff.headings.removed.length
    && !diff.links.added.length && !diff.links.removed.length && !diff.blocks.added.length && !diff.blocks.removed.length;
  return diff;
}
