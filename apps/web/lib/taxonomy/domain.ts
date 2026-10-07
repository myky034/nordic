import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import { lookupMessage, type MessageTable } from "@/lib/i18n/messages";

// Presentation and input rules for the taxonomy (Slice 11a). The rules that
// decide what is stored live in SQL (save_career_path, import_study_fields);
// these helpers only shape input and read rows for display.

export const careerPathKeyPattern = /^[a-z][a-z0-9_]{1,59}$/;

/** Keywords are typed one per line or comma-separated; blanks dropped, case-insensitive de-duplication. */
export function parseKeywords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const k = raw.trim();
    if (k && !seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); out.push(k); }
  }
  return out;
}

export type StudyFieldRow = { id: string; code: string; level: number; parent_id: string | null; name_en: string; name_vi: string };
export type StudyFieldNode = StudyFieldRow & { children: StudyFieldNode[] };

/** UNESCO's English name in English; Nordic's translation in Vietnamese. */
export const studyFieldName = (f: { name_en: string; name_vi: string }, locale: Locale = defaultLocale) => (locale === "en" ? f.name_en : f.name_vi);

/** Rows ordered by code into broad → narrow → detailed. Orphans (should not exist) become roots rather than vanish. */
export function buildFieldTree(rows: StudyFieldRow[]): StudyFieldNode[] {
  const nodes = new Map(rows.map((r) => [r.id, { ...r, children: [] as StudyFieldNode[] }]));
  const roots: StudyFieldNode[] = [];
  for (const n of [...nodes.values()].sort((a, b) => a.code.localeCompare(b.code))) {
    const parent = n.parent_id ? nodes.get(n.parent_id) : undefined;
    (parent ? parent.children : roots).push(n);
  }
  return roots;
}

/** Lower-case, accents removed, so "phan mem" finds "phần mềm" and "Malmo" finds "Malmö". */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase();

/**
 * Fields matching a query (code prefix, or words in either language), plus
 * their ancestors so a match is shown in its place in the tree.
 */
export function filterFields(rows: StudyFieldRow[], query: string): StudyFieldRow[] {
  const q = fold(query.trim());
  if (!q) return rows;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const words = q.split(/\s+/);
  const keep = new Set<string>();
  for (const r of rows) {
    const text = fold(`${r.name_en} ${r.name_vi}`);
    if (r.code.startsWith(q) || words.every((w) => text.includes(w))) {
      for (let n: StudyFieldRow | undefined = r; n && !keep.has(n.id); n = n.parent_id ? byId.get(n.parent_id) : undefined) keep.add(n.id);
    }
  }
  return rows.filter((r) => keep.has(r.id));
}

export type CareerPathRow = {
  id: string; key: string; name_vi: string; name_en: string; definition_vi: string; definition_en: string;
  include_rule: string; exclude_rule: string | null; keywords: string[]; version: number; active: boolean; updated_at: string;
};
export const careerPathName = (p: { name_vi: string; name_en: string }, locale: Locale = defaultLocale) => (locale === "en" ? p.name_en : p.name_vi);
export const careerPathDefinition = (p: { definition_vi: string; definition_en: string }, locale: Locale = defaultLocale) => (locale === "en" ? p.definition_en : p.definition_vi);

const errors: MessageTable = {
  vi: {
    taxonomy_forbidden: "Bạn cần quyền Quản lý hướng nghề (taxonomy.manage).",
    access_forbidden: "Bạn cần quyền Quản lý hướng nghề (taxonomy.manage).",
    taxonomy_duplicate: "Mã hướng nghề này đã tồn tại.",
    taxonomy_immutable: "Không đổi được mã của hướng nghề đã tạo.",
    taxonomy_not_found: "Hướng nghề không còn tồn tại. Hãy tải lại trang.",
    fallback: "Không lưu được. Kiểm tra mã (chữ thường, số, dấu gạch dưới), tên và định nghĩa ở cả hai thứ tiếng, tiêu chí tính, và từ khóa (tối đa 40, mỗi từ tối đa 80 ký tự).",
  },
  en: {
    taxonomy_forbidden: "You need the Manage career paths permission (taxonomy.manage).",
    access_forbidden: "You need the Manage career paths permission (taxonomy.manage).",
    taxonomy_duplicate: "A career path with this key already exists.",
    taxonomy_immutable: "The key of an existing career path cannot be changed.",
    taxonomy_not_found: "This career path no longer exists. Reload the page.",
    fallback: "Could not save. Check the key (lower-case letters, digits, underscores), the name and definition in both languages, the inclusion rule, and the keywords (at most 40, each at most 80 characters).",
  },
};
export function taxonomyError(code: string, locale: Locale = defaultLocale) {
  return lookupMessage(errors, code, locale);
}
export type TaxonomyState = { error?: string; message?: string };
