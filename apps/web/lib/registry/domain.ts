// Plain-language tier names (glossary: docs/learning/ui-design-system.md).
// The code (T1–T4) stays visible next to them so it can be matched with the
// Source Registry. A tier describes WHO publishes, never that a claim is true.
export const tiers = { T1: "Cơ quan nhà nước", T2: "Tổ chức / trường đại học", T3: "Nguồn chuyên môn / thứ cấp", T4: "Trải nghiệm / cộng đồng" } as const;
/** Short form for badges, where space is tight. */
export const tierShort = { T1: "Nhà nước", T2: "Tổ chức", T3: "Chuyên môn", T4: "Cộng đồng" } as const;
export type Tier = keyof typeof tiers;
export const countrySlugs = ["sweden", "denmark", "finland", "norway", "netherlands"] as const;
/**
 * Vietnamese names for the five registered countries (the UI language is
 * Vietnamese, PROJECT_SPEC.md 21). The database keeps the English name, which
 * stays visible next to it; unknown slugs fall back to the stored name.
 */
const countryNamesVi: Record<string, string> = { sweden: "Thụy Điển", denmark: "Đan Mạch", finland: "Phần Lan", norway: "Na Uy", netherlands: "Hà Lan" };
export function countryName(slug: string | null | undefined, stored: string) {
  return (slug && countryNamesVi[slug]) || stored;
}
/** countries.status (CHECK: needs_research | active | archived), in plain words. */
export const countryStatusLabels: Record<string, string> = {
  needs_research: "Đang thu thập dữ liệu", active: "Đã có dữ liệu được duyệt", archived: "Đã lưu trữ",
};
export const sourceStatuses = ["needs_verification", "verified", "review_required"] as const;
export const sourceStatusLabels: Record<(typeof sourceStatuses)[number], string> = {
  needs_verification: "Chưa xác minh", verified: "Đã xác minh", review_required: "Cần xem xét lại",
};
export const crawlPolicies = ["not_reviewed", "approved", "blocked"] as const;
export const crawlPolicyLabels: Record<(typeof crawlPolicies)[number], string> = {
  not_reviewed: "Chưa xem xét", approved: "Được phép crawl", blocked: "Không crawl",
};
/**
 * How to choose a tier, shown under the tier field (PROJECT_SPEC.md 2.5 and 7,
 * AGENTS.md 10). A tier says WHO publishes; it is never proof that each
 * statement is correct, and an unknown publisher stays unclassified.
 */
export const tierGuidance: Record<Tier, string> = {
  T1: "Cơ quan nhà nước hoặc có thẩm quyền pháp lý (di trú, thống kê quốc gia, bộ ngành). Bắt buộc cho quy định nhập cư.",
  T2: "Tổ chức EU hoặc quốc tế, trường đại học, tổ chức giáo dục chính thức.",
  T3: "Báo chí, tạp chí chuyên ngành, trang tổng hợp, công ty tư vấn.",
  T4: "Blog cá nhân, diễn đàn, mạng xã hội: chỉ là trải nghiệm, không phải chính sách.",
};

// Comma/newline/semicolon-separated free text -> a short, deduplicated topic list.
// The RPC does its own length/shape validation; this only shapes the input.
export function parseTopics(value: string): string[] {
  return [...new Set(value.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean))].slice(0, 20);
}

type Query = Record<string, string | string[] | undefined>;
export function registryFilters(query: Query) {
  const single = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const country = single("country");
  const tier = single("tier");
  const status = single("status");
  return {
    country: countrySlugs.some((slug) => slug === country) || country === "unassigned" ? country : "",
    tier: Object.hasOwn(tiers, tier) || tier === "unknown" ? tier : "",
    status: sourceStatuses.some((value) => value === status) ? status : "",
  };
}

// Conservative normalization: preserve path case, trailing slash and query order
// because removing these may merge distinct resources. This is not crawl approval.
export function canonicalSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

export function tierLabel(tier: string | null) {
  return tier && Object.hasOwn(tiers, tier) ? `${tier} · ${tiers[tier as Tier]}` : "Chưa phân loại";
}

export function verificationLabel(status: string, verifiedAt: Date | null) {
  if (status === "review_required") return "Cần xem xét lại";
  if (status !== "verified" || !verifiedAt) return "Chưa xác minh";
  // A historical review date does not establish current validity of source content.
  return "Đã xác minh nguồn · nội dung chưa kiểm tra hiệu lực";
}

export function dateLabel(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "Chưa có";
}
