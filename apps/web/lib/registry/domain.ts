import { defaultLocale, type Locale } from "@/lib/i18n/locales";

// Labels below exist in both interface languages (PROJECT_SPEC.md, Decision Log
// 2026-10-06). Functions take a locale and default to Vietnamese, so pages not
// yet translated keep working; the plain Vietnamese exports remain for them.

// Plain-language tier names (glossary: docs/learning/ui-design-system.md).
// The code (T1–T4) stays visible next to them so it can be matched with the
// Source Registry. A tier describes WHO publishes, never that a claim is true.
const tierNames = {
  vi: { T1: "Cơ quan nhà nước", T2: "Tổ chức / trường đại học", T3: "Nguồn chuyên môn / thứ cấp", T4: "Trải nghiệm / cộng đồng" },
  en: { T1: "Government authority", T2: "Organisation / university", T3: "Professional / secondary source", T4: "Experience / community" },
} as const;
/** Short form for badges, where space is tight. */
const tierShortNames = {
  vi: { T1: "Nhà nước", T2: "Tổ chức", T3: "Chuyên môn", T4: "Cộng đồng" },
  en: { T1: "Government", T2: "Organisation", T3: "Professional", T4: "Community" },
} as const;
export const tiers = tierNames.vi;
export const tierShort = tierShortNames.vi;
export type Tier = keyof typeof tiers;
export const isTier = (value: string | null | undefined): value is Tier => !!value && Object.hasOwn(tiers, value);
export const tierName = (tier: Tier, locale: Locale = defaultLocale) => tierNames[locale][tier];
export const tierShortName = (tier: Tier, locale: Locale = defaultLocale) => tierShortNames[locale][tier];
const unclassified = { vi: "Chưa phân loại", en: "Unclassified" } as const;
/** Filter options in the viewer's language. */
export const tierOptions = (locale: Locale = defaultLocale) => Object.entries(tierNames[locale]) as [Tier, string][];
export const unclassifiedLabel = (locale: Locale = defaultLocale) => unclassified[locale];
export const countrySlugs = ["sweden", "denmark", "finland", "norway", "netherlands"] as const;
/**
 * Vietnamese names for the five registered countries (the UI language is
 * Vietnamese, PROJECT_SPEC.md 21). The database keeps the English name, which
 * stays visible next to it; unknown slugs fall back to the stored name.
 */
const countryNamesVi: Record<string, string> = { sweden: "Thụy Điển", denmark: "Đan Mạch", finland: "Phần Lan", norway: "Na Uy", netherlands: "Hà Lan" };
/** In English the stored (English) name is shown as it is. */
export function countryName(slug: string | null | undefined, stored: string, locale: Locale = defaultLocale) {
  if (locale === "en") return stored;
  return (slug && countryNamesVi[slug]) || stored;
}
/** countries.status (CHECK: needs_research | active | archived), in plain words. */
const countryStatusNames: Record<Locale, Record<string, string>> = {
  vi: { needs_research: "Đang thu thập dữ liệu", active: "Đã có dữ liệu được duyệt", archived: "Đã lưu trữ" },
  en: { needs_research: "Collecting data", active: "Has reviewed data", archived: "Archived" },
};
export const countryStatusLabels = countryStatusNames.vi;
export const countryStatusLabel = (status: string, locale: Locale = defaultLocale) => countryStatusNames[locale][status] ?? status;
export const sourceStatuses = ["needs_verification", "verified", "review_required"] as const;
export type SourceStatus = (typeof sourceStatuses)[number];
const sourceStatusNames: Record<Locale, Record<SourceStatus, string>> = {
  vi: { needs_verification: "Chưa xác minh", verified: "Đã xác minh", review_required: "Cần xem xét lại" },
  en: { needs_verification: "Not verified", verified: "Verified", review_required: "Needs re-review" },
};
export const sourceStatusLabels = sourceStatusNames.vi;
export const sourceStatusLabel = (status: string, locale: Locale = defaultLocale) =>
  sourceStatusNames[locale][status as SourceStatus] ?? status;
export const crawlPolicies = ["not_reviewed", "approved", "blocked"] as const;
const crawlPolicyNames: Record<Locale, Record<(typeof crawlPolicies)[number], string>> = {
  vi: { not_reviewed: "Chưa xem xét", approved: "Được phép crawl", blocked: "Không crawl" },
  en: { not_reviewed: "Not reviewed", approved: "Crawling allowed", blocked: "Do not crawl" },
};
export const crawlPolicyLabels = crawlPolicyNames.vi;
export const crawlPolicyLabel = (policy: string, locale: Locale = defaultLocale) =>
  crawlPolicyNames[locale][policy as (typeof crawlPolicies)[number]] ?? policy;
/**
 * How to choose a tier, shown under the tier field (PROJECT_SPEC.md 2.5 and 7,
 * AGENTS.md 10). A tier says WHO publishes; it is never proof that each
 * statement is correct, and an unknown publisher stays unclassified.
 */
const tierGuidanceText: Record<Locale, Record<Tier, string>> = {
  vi: {
    T1: "Cơ quan nhà nước hoặc có thẩm quyền pháp lý (di trú, thống kê quốc gia, bộ ngành). Bắt buộc cho quy định nhập cư.",
    T2: "Tổ chức EU hoặc quốc tế, trường đại học, tổ chức giáo dục chính thức.",
    T3: "Báo chí, tạp chí chuyên ngành, trang tổng hợp, công ty tư vấn.",
    T4: "Blog cá nhân, diễn đàn, mạng xã hội: chỉ là trải nghiệm, không phải chính sách.",
  },
  en: {
    T1: "Government body or legal authority (immigration, national statistics, ministries). Required for immigration rules.",
    T2: "EU or international organisation, university, official education body.",
    T3: "Press, trade journals, aggregator sites, consultancies.",
    T4: "Personal blogs, forums, social media: experience only, not policy.",
  },
};
export const tierGuidance = tierGuidanceText.vi;
export const tierGuidanceFor = (locale: Locale = defaultLocale) => tierGuidanceText[locale];

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

export function tierLabel(tier: string | null, locale: Locale = defaultLocale) {
  return isTier(tier) ? `${tier} · ${tierName(tier, locale)}` : unclassifiedLabel(locale);
}

const verification = {
  vi: { review: "Cần xem xét lại", none: "Chưa xác minh", verified: "Đã xác minh nguồn · nội dung chưa kiểm tra hiệu lực" },
  en: { review: "Needs re-review", none: "Not verified", verified: "Source verified · content validity not checked" },
} as const;
export function verificationLabel(status: string, verifiedAt: Date | null, locale: Locale = defaultLocale) {
  if (status === "review_required") return verification[locale].review;
  if (status !== "verified" || !verifiedAt) return verification[locale].none;
  // A historical review date does not establish current validity of source content.
  return verification[locale].verified;
}

const notYet = { vi: "Chưa có", en: "Not yet" } as const;
export function dateLabel(date: Date | null, locale: Locale = defaultLocale) {
  return date ? date.toISOString().slice(0, 10) : notYet[locale];
}
