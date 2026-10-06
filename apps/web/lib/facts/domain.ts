import { lookupMessage, type MessageTable } from "@/lib/i18n/messages";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";

export type FactState = { error?: string; message?: string };
// Validity wording in both interface languages. The rule is the same in both:
// a claim is never described as currently valid, only as not yet / no longer
// within the dates the source states, or "not verified" (AGENTS.md §12).
const validityText = {
  vi: {
    full: { future: "Chưa đến thời gian áp dụng được ghi nhận", past: "Đã quá thời hạn được ghi nhận", unknown: "Hiệu lực hiện tại chưa được xác minh" },
    short: { future: "chưa đến thời gian áp dụng", past: "đã quá thời hạn ghi nhận", unknown: "hiệu lực hiện tại chưa xác minh" },
  },
  en: {
    full: { future: "Not yet within the recorded validity period", past: "Past the recorded validity period", unknown: "Current validity not verified" },
    short: { future: "not yet in force", past: "past the recorded end date", unknown: "current validity not verified" },
  },
} as const;
function validityState(from: string | null, until: string | null, now: Date) {
  const today = now.toISOString().slice(0, 10);
  if (from && from > today) return "future";
  if (until && until < today) return "past";
  return "unknown";
}
export function validity(from: string | null, until: string | null, now = new Date(), locale: Locale = defaultLocale) {
  return validityText[locale].full[validityState(from, until, now)];
}
/** One-phrase validity for the compact source line on public fact cards;
 *  same rules as validity(), the full wording sits under "Xem bằng chứng". */
export function validityShort(from: string | null, until: string | null, now = new Date(), locale: Locale = defaultLocale) {
  return validityText[locale].short[validityState(from, until, now)];
}
const factErrors: MessageTable = {
  vi: {
    facts_forbidden: "Bạn chưa có quyền thực hiện thao tác này.", access_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
    facts_already_decided: "Đề xuất đã được xử lý. Hãy tải lại trang; không ghi đè quyết định cũ.",
    facts_conflict_requires_review: "Chỉ đánh dấu mâu thuẫn giữa hai thông tin đã được duyệt bằng chứng. Hãy duyệt hoặc từ chối đề xuất trước.",
    facts_country_required: "Số liệu gắn với một nghề phải có quốc gia. Hãy chọn quốc gia mà số liệu mô tả.",
    facts_not_flagged: "Thông tin này không còn trong hàng chờ nguồn đã đổi. Hãy tải lại trang.",
    facts_invalid_period: "Kỳ số liệu phải có dạng 2024, 2024-Q2, 2024-H1 hoặc 2024-09.",
    facts_country_mismatch: "Quốc gia đã chọn khác quốc gia của trường/chương trình. Bỏ trống quốc gia hoặc chọn đúng.",
    fallback: "Không lưu được. Kiểm tra các trường bắt buộc, bằng chứng và ngày hiệu lực rồi thử lại.",
  },
  en: {
    facts_forbidden: "You do not have permission to do this.", access_forbidden: "You do not have permission to do this.",
    facts_already_decided: "This proposal has already been decided. Reload the page; earlier decisions are never overwritten.",
    facts_conflict_requires_review: "A conflict can only be marked between two reviewed facts. Review or reject the proposal first.",
    facts_country_required: "A figure linked to an occupation needs a country. Choose the country the figure describes.",
    facts_not_flagged: "This fact is no longer in the changed-source queue. Reload the page.",
    facts_invalid_period: "The reference period must look like 2024, 2024-Q2, 2024-H1 or 2024-09.",
    facts_country_mismatch: "The chosen country differs from the university's or programme's country. Leave the country empty or choose the right one.",
    fallback: "Could not save. Check the required fields, the evidence and the validity dates, then try again.",
  },
};
export function factError(code: string, locale: Locale = defaultLocale) {
  return lookupMessage(factErrors, code, locale);
}
// Readable names for the fixed AI topic codes (extraction_topics() in the
// Slice 10a migration). Manually entered topics are free text written by an
// editor, so anything not in this list is shown exactly as entered.
const topicNames: Record<Locale, Record<string,string>> = {
  vi: {
    education: "Giáo dục", admission: "Tuyển sinh", tuition: "Học phí", deadline: "Hạn nộp hồ sơ",
    scholarship: "Học bổng", immigration: "Nhập cư", labour_market: "Thị trường lao động",
    living_cost: "Chi phí sinh hoạt", housing: "Nhà ở", language: "Ngôn ngữ", other: "Khác",
  },
  en: {
    education: "Education", admission: "Admission", tuition: "Tuition", deadline: "Application deadline",
    scholarship: "Scholarship", immigration: "Immigration", labour_market: "Labour market",
    living_cost: "Cost of living", housing: "Housing", language: "Language", other: "Other",
  },
};
export function topicLabel(topic: string, locale: Locale = defaultLocale) {
  return Object.hasOwn(topicNames[locale], topic) ? topicNames[locale][topic] : topic;
}
const statusNames: Record<Locale, Record<string,string>> = {
  vi: { proposed: "Chờ duyệt", reviewed: "Đã duyệt bằng chứng", rejected: "Đã từ chối", conflicted: "Có mâu thuẫn" },
  en: { proposed: "Awaiting review", reviewed: "Evidence reviewed", rejected: "Rejected", conflicted: "Conflicting sources" },
};
export const statuses = statusNames.vi;
export const statusLabel = (status: string, locale: Locale = defaultLocale) => statusNames[locale][status] ?? status;
