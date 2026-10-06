import { defaultLocale, locales, type Locale } from "@/lib/i18n/locales";

// Rules for the user-private workspace (Slice 8). Pure functions/constants so
// they are testable and shared by server actions, pages and the save button.

// Kinds of item a user can bookmark or annotate. `column` is the FK column in
// saved_items / notes; exactly one is set per row (database CHECK).
export const itemKinds = {
  country: { column: "country_id", label: "Quốc gia", table: "countries", title: "name", href: (id: string, slug?: string) => `/countries/${slug ?? id}` },
  university: { column: "university_id", label: "Trường", table: "universities", title: "name", href: (id: string) => `/universities/${id}` },
  programme: { column: "programme_id", label: "Chương trình", table: "programmes", title: "name", href: (id: string) => `/programmes/${id}` },
  immigration_rule: { column: "immigration_rule_id", label: "Quy định nhập cư", table: "immigration_rules", title: "title", href: (id: string) => `/immigration/${id}` },
  occupation: { column: "occupation_id", label: "Nghề", table: "occupations", title: "name", href: (id: string) => `/occupations/${id}` },
  source: { column: "source_id", label: "Nguồn", table: "sources", title: "name", href: (id: string) => `/sources/${id}` },
} as const;
export type ItemKind = keyof typeof itemKinds;
export const itemKindList = Object.keys(itemKinds) as ItemKind[];
const itemKindNamesEn: Record<ItemKind, string> = {
  country: "Country", university: "University", programme: "Programme", immigration_rule: "Immigration rule", occupation: "Occupation", source: "Source",
};
/** Item kind label in the viewer's language (the Vietnamese one lives in itemKinds). */
export const itemKindLabel = (kind: ItemKind, locale: Locale = defaultLocale) => locale === "en" ? itemKindNamesEn[kind] : itemKinds[kind].label;
export function isItemKind(value: unknown): value is ItemKind {
  return typeof value === "string" && Object.hasOwn(itemKinds, value);
}

// PostgREST select for a saved item / note with the referenced item embedded.
export const itemEmbeds = "countries(id,slug,name),universities(id,name),programmes(id,name),immigration_rules(id,title),occupations(id,name),sources(id,name)";
type Embedded = {
  countries?: { id: string; slug: string; name: string } | null; universities?: { id: string; name: string } | null;
  programmes?: { id: string; name: string } | null; immigration_rules?: { id: string; title: string } | null;
  occupations?: { id: string; name: string } | null; sources?: { id: string; name: string } | null;
};
/** Resolves which item a row points at, its label and link. */
export function describeItem(row: Embedded): { kind: ItemKind; id: string; title: string; href: string } | null {
  if (row.countries) return { kind: "country", id: row.countries.id, title: row.countries.name, href: itemKinds.country.href(row.countries.id, row.countries.slug) };
  if (row.universities) return { kind: "university", id: row.universities.id, title: row.universities.name, href: itemKinds.university.href(row.universities.id) };
  if (row.programmes) return { kind: "programme", id: row.programmes.id, title: row.programmes.name, href: itemKinds.programme.href(row.programmes.id) };
  if (row.immigration_rules) return { kind: "immigration_rule", id: row.immigration_rules.id, title: row.immigration_rules.title, href: itemKinds.immigration_rule.href(row.immigration_rules.id) };
  if (row.occupations) return { kind: "occupation", id: row.occupations.id, title: row.occupations.name, href: itemKinds.occupation.href(row.occupations.id) };
  if (row.sources) return { kind: "source", id: row.sources.id, title: row.sources.name, href: itemKinds.source.href(row.sources.id) };
  return null;
}

const applicationStatusNames = {
  vi: { exploring: "Đang tìm hiểu", preparing: "Đang chuẩn bị hồ sơ", applying: "Đang nộp hồ sơ", awaiting_decision: "Chờ kết quả", admitted: "Đã trúng tuyển", paused: "Tạm dừng" },
  en: { exploring: "Exploring", preparing: "Preparing an application", applying: "Applying", awaiting_decision: "Awaiting a decision", admitted: "Admitted", paused: "Paused" },
} as const;
const targetDegreeNames = {
  vi: { bachelor: "Cử nhân", master: "Thạc sĩ", phd: "Tiến sĩ", other: "Khác" },
  en: { bachelor: "Bachelor's", master: "Master's", phd: "PhD", other: "Other" },
} as const;
const budgetPeriodNames = {
  vi: { total: "Tổng", per_year: "Mỗi năm", per_month: "Mỗi tháng" },
  en: { total: "Total", per_year: "Per year", per_month: "Per month" },
} as const;
export const applicationStatuses = applicationStatusNames.vi;
export const targetDegrees = targetDegreeNames.vi;
export const budgetPeriods = budgetPeriodNames.vi;
/** [value, label] pairs for the plan form's selects, in the viewer's language. */
export const applicationStatusOptions = (locale: Locale = defaultLocale) => Object.entries(applicationStatusNames[locale]);
export const targetDegreeOptions = (locale: Locale = defaultLocale) => Object.entries(targetDegreeNames[locale]);
export const budgetPeriodOptions = (locale: Locale = defaultLocale) => Object.entries(budgetPeriodNames[locale]);
export const targetDegreeLabel = (degree: string, locale: Locale = defaultLocale) =>
  Object.hasOwn(targetDegrees, degree) ? targetDegreeNames[locale][degree as keyof typeof targetDegrees] : degree;

/** Year field: empty → null; otherwise an integer 2000–2100, else "invalid". */
export function parseYear(raw: string): number | null | "invalid" {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : "invalid";
}

/** Budget is all-or-nothing, like the database CHECK. */
export function parseBudget(amount: string, currency: string, period: string) {
  const a = amount.trim(), c = currency.trim().toUpperCase(), p = period.trim();
  if (!a && !c && !p) return { amount: null, currency: null, period: null } as const;
  const n = Number(a.replace(/[\s,]/g, ""));
  if (!a || !Number.isFinite(n) || n < 0 || n > 9_999_999_999 || !/^[A-Z]{3}$/.test(c) || !Object.hasOwn(budgetPeriods, p)) return "invalid" as const;
  return { amount: Math.round(n * 100) / 100, currency: c, period: p } as const;
}

// Typed confirmation for irreversible deletes, in the interface language.
const deleteWords: Record<Locale, string> = { vi: "XÓA", en: "DELETE" };
export const DELETE_CONFIRMATION = deleteWords.vi;
export const deleteConfirmation = (locale: Locale = defaultLocale) => deleteWords[locale];
/** Either language's word is accepted, in case the visitor switched language
 *  between loading the form and submitting it; typing it is still deliberate. */
export const isDeleteConfirmation = (typed: string) => locales.some((l) => deleteWords[l] === typed);

const errors: Record<Locale, Record<string, string>> = {
  vi: {
    access_unauthenticated: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
    "23505": "Mục này đã có trong danh sách đã lưu.",
    "42501": "Không thể thực hiện: mục không công khai, hoặc dự án không thuộc về bạn.",
    fallback: "Không lưu được. Kiểm tra lại dữ liệu và thử lại.",
  },
  en: {
    access_unauthenticated: "Your session has expired. Please sign in again.",
    "23505": "This item is already in your saved list.",
    "42501": "Not allowed: the item is not public, or the project is not yours.",
    fallback: "Could not save. Check the data and try again.",
  },
};
export function workspaceError(code: string, locale: Locale = defaultLocale) {
  const table = errors[locale];
  // Own keys only: a code such as "constructor" must not reach Object.prototype.
  return code !== "fallback" && Object.hasOwn(table, code) ? table[code] : table.fallback;
}
export type WorkspaceState = { error?: string; message?: string };
