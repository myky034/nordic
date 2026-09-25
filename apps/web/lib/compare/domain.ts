import { countrySlugs } from "../registry/domain";

// Mirrors comparison_metrics.category (PROJECT_SPEC.md Section 2.10 list).
export const metricCategories = {
  education: "Education", tuition: "Tuition", living_cost: "Living cost", labour_market: "Labour market",
  immigration: "Immigration", housing: "Housing", language: "Language", quality_of_life: "Quality of life", other: "Other",
} as const;
export type MetricCategory = keyof typeof metricCategories;
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

export type CellFact = { id: string; metric_id: string | null; country_id: string; reference_period: string | null; status: string; created_at?: string };

/**
 * Groups facts into cells keyed "metricId:countryId". Every value is kept —
 * nothing is averaged, deduplicated or picked (AGENTS.md 1.4). Within a cell,
 * the most recent reference period comes first; values without a period last.
 */
export function buildCells<T extends CellFact>(facts: T[]) {
  const cells = new Map<string, T[]>();
  for (const fact of facts) {
    if (!fact.metric_id) continue;
    const key = `${fact.metric_id}:${fact.country_id}`;
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

const errors: Record<string, string> = {
  metrics_forbidden: "Bạn chưa có quyền quản lý chỉ số so sánh (cần metrics.manage).",
  access_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  metrics_duplicate: "Key này đã tồn tại. Mỗi chỉ số cần một key riêng.",
  metrics_immutable: "Không thể đổi key hoặc nhóm của chỉ số đã tạo, vì các thông tin đã gắn sẽ bị đổi nghĩa. Hãy tạo chỉ số mới và ngừng dùng chỉ số cũ.",
  metrics_not_found: "Chỉ số không còn tồn tại. Hãy tải lại trang.",
};
export function metricError(code: string) {
  return errors[code] ?? "Không lưu được. Key chỉ gồm chữ thường, số, dấu gạch dưới (bắt đầu bằng chữ); cần tên và mô tả.";
}
export type MetricState = { error?: string; message?: string };
