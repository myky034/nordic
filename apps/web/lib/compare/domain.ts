import { lookupMessage, type MessageTable } from "@/lib/i18n/messages";
import { countrySlugs } from "../registry/domain";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";


// Mirrors fact_types.category (was comparison_metrics; PROJECT_SPEC.md Section 2.10 list).
const metricCategoryNames = {
  vi: {
    education: "Giáo dục", tuition: "Học phí", living_cost: "Chi phí sinh hoạt", labour_market: "Thị trường lao động",
    immigration: "Nhập cư", housing: "Nhà ở", language: "Ngôn ngữ", quality_of_life: "Chất lượng sống", other: "Khác",
  },
  en: {
    education: "Education", tuition: "Tuition", living_cost: "Cost of living", labour_market: "Labour market",
    immigration: "Immigration", housing: "Housing", language: "Language", quality_of_life: "Quality of life", other: "Other",
  },
} as const;
export const metricCategories = metricCategoryNames.vi;
export type MetricCategory = keyof typeof metricCategories;
export const metricCategoryLabel = (category: string, locale: Locale = defaultLocale) =>
  Object.hasOwn(metricCategories, category) ? metricCategoryNames[locale][category as MetricCategory] : category;
export const metricKeyPattern = /^[a-z][a-z0-9_]{1,59}$/;
export const MIN_COUNTRIES = 2;
export const MAX_COUNTRIES = 5;

type Query = Record<string, string | string[] | undefined>;

/** ?c=sweden&c=denmark → allowlisted, de-duplicated, in a stable order, max 5. */
export function compareCountries(query: Query) {
  const raw = query.c;
  const picked = new Set((Array.isArray(raw) ? raw : raw ? [raw] : []).map((v) => v.trim().toLowerCase()));
  const countries = countrySlugs.filter((slug) => picked.has(slug)).slice(0, MAX_COUNTRIES);
  return { countries, ready: countries.length >= MIN_COUNTRIES };
}

export function categoryParam(query: Query): MetricCategory | "" {
  const raw = typeof query.category === "string" ? query.category : "";
  return Object.hasOwn(metricCategories, raw) ? raw as MetricCategory : "";
}

export type CellFact = { id: string; fact_type_id: string | null; country_id: string; reference_period: string | null; status: string; created_at?: string };

/**
 * Groups facts into cells keyed "factTypeId:countryId". Every value is kept —
 * nothing is averaged, deduplicated or picked (AGENTS.md 1.4). Within a cell,
 * the most recent reference period comes first; values without a period last.
 */
export function buildCells<T extends CellFact>(facts: T[]) {
  const cells = new Map<string, T[]>();
  for (const fact of facts) {
    if (!fact.fact_type_id) continue;
    const key = `${fact.fact_type_id}:${fact.country_id}`;
    cells.set(key, [...(cells.get(key) ?? []), fact]);
  }
  for (const list of cells.values()) list.sort((a, b) =>
    (b.reference_period ?? "").localeCompare(a.reference_period ?? "") || (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return cells;
}

/** URL for the comparison page with a new set of countries (other params kept). */
export function compareHref(countries: readonly string[], extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  for (const c of countries) params.append("c", c);
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  const text = params.toString();
  return text ? `/compare?${text}` : "/compare";
}

// ---------------------------------------------------------------- fact types (L3a, 2026-10-13)
// Comparison metrics became fact types (docs/architecture/fact-types-plan.md).
// These lists mirror the CHECK constraints of fact_types / facts.

export const valueKinds = ["money", "number", "date", "text"] as const;
export type ValueKind = (typeof valueKinds)[number];
export const appliesToValues = ["programme", "university", "immigration_rule", "occupation", "country"] as const;
export type AppliesTo = (typeof appliesToValues)[number];
export const valuePeriods = ["year", "semester", "month", "week", "total", "one_off"] as const;
export type ValuePeriod = (typeof valuePeriods)[number];
export const currencyPattern = /^[A-Z]{3}$/;

const kindNames: Record<Locale, Record<ValueKind, string>> = {
  vi: { money: "Số tiền", number: "Con số", date: "Ngày", text: "Chữ" },
  en: { money: "Amount of money", number: "Number", date: "Date", text: "Text" },
};
const appliesNames: Record<Locale, Record<AppliesTo, string>> = {
  vi: { programme: "Chương trình học", university: "Trường", immigration_rule: "Quy định nhập cư", occupation: "Nghề", country: "Quốc gia" },
  en: { programme: "Programme", university: "University", immigration_rule: "Immigration rule", occupation: "Occupation", country: "Country" },
};
const periodNames: Record<Locale, Record<ValuePeriod, string>> = {
  vi: { year: "năm", semester: "học kỳ", month: "tháng", week: "tuần", total: "toàn khóa", one_off: "một lần" },
  en: { year: "year", semester: "semester", month: "month", week: "week", total: "total", one_off: "one-off" },
};
const pick = <K extends string>(table: Record<Locale, Record<K, string>>, value: string, locale: Locale) =>
  Object.hasOwn(table[locale], value) ? table[locale][value as K] : value;
export const valueKindLabel = (v: string, locale: Locale = defaultLocale) => pick(kindNames, v, locale);
export const appliesToLabel = (v: string, locale: Locale = defaultLocale) => pick(appliesNames, v, locale);
export const valuePeriodLabel = (v: string, locale: Locale = defaultLocale) => pick(periodNames, v, locale);

/** The type's name in the viewer's language (both are required). */
export const factTypeLabel = (t: { label_vi: string; label_en: string }, locale: Locale = defaultLocale) => (locale === "en" ? t.label_en : t.label_vi);
export const factTypeDefinition = (t: { definition_vi: string; definition_en: string }, locale: Locale = defaultLocale) => (locale === "en" ? t.definition_en : t.definition_vi);

/**
 * A typed fact's structured value, written for the viewer: "145 000 SEK / năm",
 * "6,5", "15/01/2027". Formatting only — no unit or currency conversion
 * (AGENTS.md §1). Null when the fact has no structured value; the verbatim
 * `value` is always shown next to it by the caller.
 */
export function formatStructuredValue(
  f: { value_number?: number | string | null; value_currency?: string | null; value_period?: string | null; value_date?: string | null },
  locale: Locale = defaultLocale,
): string | null {
  const tag = locale === "en" ? "en-GB" : "vi-VN";
  if (f.value_date) {
    const d = new Date(`${f.value_date}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? f.value_date : d.toLocaleDateString(tag, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  }
  if (f.value_number === null || f.value_number === undefined || f.value_number === "") return null;
  const n = Number(f.value_number);
  if (!Number.isFinite(n)) return null;
  const number = n.toLocaleString(tag, { maximumFractionDigits: 6 });
  const money = f.value_currency ? `${number} ${f.value_currency}` : number;
  return f.value_period ? `${money} / ${valuePeriodLabel(f.value_period, locale)}` : money;
}

const errors: MessageTable = {
  vi: {
  fact_types_forbidden: "Bạn chưa có quyền quản lý loại thông tin (cần metrics.manage).",
  metrics_forbidden: "Bạn chưa có quyền quản lý loại thông tin (cần metrics.manage).",
  fact_types_duplicate: "Mã này đã tồn tại. Mỗi loại thông tin cần một mã riêng.",
  fact_types_immutable: "Không đổi được mã, kiểu giá trị, đối tượng hay nhóm của loại đã tạo, vì các thông tin đã gắn sẽ bị đổi nghĩa. Hãy tạo loại mới và ngừng dùng loại cũ.",
  fact_types_not_found: "Loại thông tin không còn tồn tại. Hãy tải lại trang.",
  access_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  metrics_duplicate: "Key này đã tồn tại. Mỗi chỉ số cần một key riêng.",
  metrics_immutable: "Không thể đổi key hoặc nhóm của chỉ số đã tạo, vì các thông tin đã gắn sẽ bị đổi nghĩa. Hãy tạo chỉ số mới và ngừng dùng chỉ số cũ.",
  metrics_not_found: "Chỉ số không còn tồn tại. Hãy tải lại trang.",
    fallback: "Không lưu được. Mã chỉ gồm chữ thường, số, dấu gạch dưới (bắt đầu bằng chữ); cần tên và định nghĩa ở cả hai thứ tiếng; khoảng giá trị chỉ dùng cho kiểu \"Con số\" và giá trị nhỏ nhất không lớn hơn lớn nhất.",
  },
  en: {
    fact_types_forbidden: "You do not have permission to manage fact types (needs metrics.manage).",
    metrics_forbidden: "You do not have permission to manage fact types (needs metrics.manage).",
    fact_types_duplicate: "This key already exists. Each fact type needs its own key.",
    fact_types_immutable: "The key, value kind, entity or group of an existing fact type cannot change, because the facts linked to it would change meaning. Create a new type and retire the old one.",
    fact_types_not_found: "The fact type no longer exists. Reload the page.",
    access_forbidden: "You do not have permission to do this.",
    metrics_duplicate: "This key already exists. Each metric needs its own key.",
    metrics_immutable: "The key or group of an existing metric cannot change, because the facts linked to it would change meaning. Create a new metric and retire the old one.",
    metrics_not_found: "The metric no longer exists. Reload the page.",
    fallback: "Could not save. The key may only contain lowercase letters, digits and underscores (starting with a letter); names and definitions are required in both languages; a range is only for the \"Number\" kind and its minimum may not exceed its maximum.",
  },
};
export function metricError(code: string, locale: Locale = defaultLocale) {
  return lookupMessage(errors, code, locale);
}
export type MetricState = { error?: string; message?: string };
