// Presentation rules for the crawler admin screen (Slice 9).
export const crawlOutcomes: Record<string, { label: string; tone: "positive" | "neutral" | "caution" | "critical" | "accent" }> = {
  created: { label: "Phiên bản mới", tone: "accent" },
  unchanged: { label: "Không đổi", tone: "neutral" },
  not_modified: { label: "Không đổi (304)", tone: "neutral" },
  robots_disallowed: { label: "robots.txt chặn", tone: "caution" },
  skipped_type: { label: "Sai loại nội dung", tone: "caution" },
  too_large: { label: "Quá lớn", tone: "caution" },
  error: { label: "Lỗi", tone: "critical" },
};
export const runStatuses: Record<string, { label: string; tone: "positive" | "neutral" | "caution" | "critical" | "accent" }> = {
  running: { label: "Đang chạy", tone: "accent" }, succeeded: { label: "Thành công", tone: "positive" },
  partial: { label: "Có lỗi một phần", tone: "caution" }, failed: { label: "Thất bại", tone: "critical" },
};
/** Why a source's targets will or will not be fetched on the next run. */
export function crawlReadiness(source: { crawl_enabled: boolean; crawl_policy: string; status: string }) {
  if (source.crawl_enabled && source.crawl_policy === "approved" && source.status === "verified") return { ready: true, reason: "Sẽ được crawl ở lần chạy tới" };
  const missing = [
    source.status !== "verified" && "nguồn chưa verified",
    source.crawl_policy !== "approved" && "crawl policy chưa approved",
    !source.crawl_enabled && "chưa bật crawl",
  ].filter(Boolean);
  return { ready: false, reason: `Chưa crawl: ${missing.join(", ")}` };
}
const errors: Record<string, string> = {
  crawler_forbidden: "Bạn cần quyền crawler.manage.",
  access_forbidden: "Bạn cần quyền crawler.manage.",
  crawler_url_not_source: "URL phải cùng domain với canonical URL của nguồn.",
  crawler_duplicate: "URL này đã được đăng ký cho nguồn.",
};
export function crawlerError(code: string) {
  return errors[code] ?? "Không lưu được. Kiểm tra URL (http/https), loại, tiền tố (bắt đầu bằng /, chỉ cho sitemap) và số URL tối đa (1–100).";
}
export type CrawlerState = { error?: string; message?: string };
