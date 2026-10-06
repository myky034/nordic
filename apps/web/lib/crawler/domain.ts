import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import { lookupMessage, type MessageTable } from "@/lib/i18n/messages";
// Presentation rules for the crawler admin screen (Slice 9).
type Label = { label: string; tone: "positive" | "neutral" | "caution" | "critical" | "accent" };
const outcomeLabels: Record<Locale, Record<string, Label>> = {
  vi: {
    created: { label: "Phiên bản mới", tone: "accent" },
    unchanged: { label: "Không đổi", tone: "neutral" },
    not_modified: { label: "Không đổi (304)", tone: "neutral" },
    robots_disallowed: { label: "robots.txt chặn", tone: "caution" },
    skipped_type: { label: "Sai loại nội dung", tone: "caution" },
    too_large: { label: "Quá lớn", tone: "caution" },
    error: { label: "Lỗi", tone: "critical" },
  },
  en: {
    created: { label: "New version", tone: "accent" },
    unchanged: { label: "Unchanged", tone: "neutral" },
    not_modified: { label: "Unchanged (304)", tone: "neutral" },
    robots_disallowed: { label: "Blocked by robots.txt", tone: "caution" },
    skipped_type: { label: "Wrong content type", tone: "caution" },
    too_large: { label: "Too large", tone: "caution" },
    error: { label: "Error", tone: "critical" },
  },
};
const runStatusLabels: Record<Locale, Record<string, Label>> = {
  vi: {
    running: { label: "Đang chạy", tone: "accent" }, succeeded: { label: "Thành công", tone: "positive" },
    partial: { label: "Có lỗi một phần", tone: "caution" }, failed: { label: "Thất bại", tone: "critical" },
  },
  en: {
    running: { label: "Running", tone: "accent" }, succeeded: { label: "Succeeded", tone: "positive" },
    partial: { label: "Partly failed", tone: "caution" }, failed: { label: "Failed", tone: "critical" },
  },
};
// Vietnamese tables kept for existing callers (dev preview).
export const crawlOutcomes = outcomeLabels.vi;
export const runStatuses = runStatusLabels.vi;
/** Unknown outcomes are shown as recorded, in a neutral badge. */
export function crawlOutcome(outcome: string, locale: Locale = defaultLocale): Label {
  const t = outcomeLabels[locale];
  return Object.hasOwn(t, outcome) ? t[outcome] : { label: outcome, tone: "neutral" };
}
/** Unknown statuses fall back to "failed" so a new SQL value never looks healthy. */
export function crawlRunStatus(status: string, locale: Locale = defaultLocale) {
  const t = runStatusLabels[locale];
  return Object.hasOwn(t, status) ? t[status] : t.failed;
}
const readiness = {
  vi: { ready: "Sẽ được lấy ở lần chạy tới", unverified: "nguồn chưa xác minh", policy: "chính sách crawl chưa là “Được phép crawl”", disabled: "chưa bật crawl", notReady: (m: string) => `Chưa lấy được: ${m}` },
  en: { ready: "Will be fetched on the next run", unverified: "source not verified", policy: "crawl policy is not “Crawl allowed”", disabled: "crawling not enabled", notReady: (m: string) => `Not fetched yet: ${m}` },
};
/** Why a source's targets will or will not be fetched on the next run. */
export function crawlReadiness(source: { crawl_enabled: boolean; crawl_policy: string; status: string }, locale: Locale = defaultLocale) {
  const t = readiness[locale];
  if (source.crawl_enabled && source.crawl_policy === "approved" && source.status === "verified") return { ready: true, reason: t.ready };
  const missing = [
    source.status !== "verified" && t.unverified,
    source.crawl_policy !== "approved" && t.policy,
    !source.crawl_enabled && t.disabled,
  ].filter(Boolean);
  return { ready: false, reason: t.notReady(missing.join(", ")) };
}
const errors: MessageTable = {
  vi: {
  crawler_forbidden: "Bạn cần quyền Quản lý crawler (crawler.manage).",
  access_forbidden: "Bạn cần quyền Quản lý crawler (crawler.manage).",
  crawler_url_not_source: "URL phải cùng tên miền với URL gốc của nguồn.",
  crawler_duplicate: "URL này đã được đăng ký cho nguồn.",
    fallback: "Không lưu được. Kiểm tra URL (http/https), loại, tiền tố (bắt đầu bằng /, chỉ cho sitemap) và số URL tối đa (1–100).",
  },
  en: {
    crawler_forbidden: "You need the Manage crawler permission (crawler.manage).",
    access_forbidden: "You need the Manage crawler permission (crawler.manage).",
    crawler_url_not_source: "The URL must be on the same domain as the source's own URL.",
    crawler_duplicate: "This URL is already registered for the source.",
    fallback: "Could not save. Check the URL (http/https), the type, the path prefix (starts with /, sitemaps only) and the URL limit (1–100).",
  },
};
export function crawlerError(code: string, locale: Locale = defaultLocale) {
  return lookupMessage(errors, code, locale);
}
export type CrawlerState = { error?: string; message?: string };
