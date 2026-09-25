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

export const applicationStatuses = {
  exploring: "Đang tìm hiểu", preparing: "Đang chuẩn bị hồ sơ", applying: "Đang nộp hồ sơ",
  awaiting_decision: "Chờ kết quả", admitted: "Đã trúng tuyển", paused: "Tạm dừng",
} as const;
export const targetDegrees = { bachelor: "Bachelor", master: "Master", phd: "PhD", other: "Khác" } as const;
export const budgetPeriods = { total: "Tổng", per_year: "Mỗi năm", per_month: "Mỗi tháng" } as const;

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

// Typed confirmation for the irreversible "delete my workspace" action.
export const DELETE_CONFIRMATION = "XÓA";

const errors: Record<string, string> = {
  access_unauthenticated: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
  "23505": "Mục này đã có trong danh sách đã lưu.",
  "42501": "Không thể thực hiện: mục không công khai, hoặc project không thuộc về bạn.",
};
export function workspaceError(code: string) {
  return errors[code] ?? "Không lưu được. Kiểm tra lại dữ liệu và thử lại.";
}
export type WorkspaceState = { error?: string; message?: string };
