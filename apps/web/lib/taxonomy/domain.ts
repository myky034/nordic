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

// ---------------------------------------------------------------- Slice 11b: classifications

/** Host of an http(s) URL, lower-case, without "www." — same rule as public.url_host() in SQL. */
export function urlHost(url: string): string | null {
  const m = /^https?:\/\/([^/:?#]+)/i.exec(url.trim());
  return m ? m[1].toLowerCase().replace(/^www\./, "") : null;
}
/**
 * Does a document come from the programme's own site? Same host, or one is a
 * subdomain of the other (education.uni.se ↔ uni.se). Mirrors the check in
 * propose_classification(), so the form only offers documents the database
 * will accept; the database still decides.
 */
export function sameSite(documentUrl: string, programmeUrl: string) {
  const d = urlHost(documentUrl), p = urlHost(programmeUrl);
  return !!d && !!p && (d === p || d.endsWith(`.${p}`) || p.endsWith(`.${d}`));
}
/** A reviewed career-path classification judged against older criteria than the current ones. */
export function isStale(c: { status: string; career_path_version: number | null; career_paths: { version: number } | null }) {
  return c.status === "reviewed" && c.career_path_version !== null && !!c.career_paths && c.career_path_version < c.career_paths.version;
}
/** Fields a programme can be classified into: everything except "99 Field unknown". */
export const classifiableFields = <T extends { code: string }>(rows: T[]) => rows.filter((r) => !r.code.startsWith("99"));

const classificationErrors: MessageTable = {
  vi: {
    classification_forbidden: "Bạn chưa có quyền này (đề xuất cần education.manage, duyệt cần facts.review).",
    access_forbidden: "Bạn chưa có quyền này (đề xuất cần education.manage, duyệt cần facts.review).",
    classification_programme_ineligible: "Chỉ phân loại chương trình thạc sĩ hoặc tiến sĩ đã được duyệt.",
    classification_career_path_retired: "Hướng nghề này đã ngừng dùng.",
    classification_document_missing: "Không tìm thấy tài liệu bằng chứng.",
    classification_document_mismatch: "Tài liệu phải là trang trên website của chính chương trình (cùng tên miền với trang chính thức).",
    classification_duplicate: "Chương trình đã có phân loại này (đang chờ duyệt hoặc đã duyệt).",
    classification_already_decided: "Phân loại này đã có quyết định. Hãy tải lại trang.",
    classification_not_stale: "Phân loại này đã khớp phiên bản tiêu chí hiện tại.",
    classification_missing: "Phân loại không còn tồn tại. Hãy tải lại trang.",
    fallback: "Không lưu được. Kiểm tra chương trình, ngành hoặc hướng nghề, tài liệu và trích đoạn (tối đa 500 ký tự); ghi chú duyệt là bắt buộc.",
  },
  en: {
    classification_forbidden: "You do not have this permission (proposing needs education.manage, reviewing needs facts.review).",
    access_forbidden: "You do not have this permission (proposing needs education.manage, reviewing needs facts.review).",
    classification_programme_ineligible: "Only reviewed Master's or PhD programmes can be classified.",
    classification_career_path_retired: "This career path has been retired.",
    classification_document_missing: "The evidence document was not found.",
    classification_document_mismatch: "The document must be a page on the programme's own website (same domain as its official page).",
    classification_duplicate: "The programme already has this classification (waiting or reviewed).",
    classification_already_decided: "This classification has already been decided. Reload the page.",
    classification_not_stale: "This classification already matches the current criteria version.",
    classification_missing: "This classification no longer exists. Reload the page.",
    fallback: "Could not save. Check the programme, the field or career path, the document and the excerpt (at most 500 characters); a review note is required.",
  },
};
export function classificationError(code: string, locale: Locale = defaultLocale) {
  return lookupMessage(classificationErrors, code, locale);
}
