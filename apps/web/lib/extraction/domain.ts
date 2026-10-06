import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import { lookupMessage, type MessageTable } from "@/lib/i18n/messages";
import type { Tone } from "@/components/ui";

// Presentation rules for AI extraction (Slice 10a). Labels only; every rule
// that decides what becomes a proposal lives in extractor_propose() (SQL).
type Label = { label: string; tone: Tone };
type Labels = Record<Locale, Record<string, Label>>;
const requestStatusLabels: Labels = {
  vi: {
    pending: { label: "Đang chờ lần chạy tới", tone: "accent" },
    running: { label: "Đang xử lý", tone: "accent" },
    done: { label: "Đã xong", tone: "positive" },
    failed: { label: "Lỗi", tone: "critical" },
    cancelled: { label: "Đã hủy", tone: "neutral" },
  },
  en: {
    pending: { label: "Waiting for the next run", tone: "accent" },
    running: { label: "Processing", tone: "accent" },
    done: { label: "Done", tone: "positive" },
    failed: { label: "Error", tone: "critical" },
    cancelled: { label: "Cancelled", tone: "neutral" },
  },
};
const itemOutcomeLabels: Labels = {
  vi: {
    proposed: { label: "Đã tạo đề xuất", tone: "positive" },
    invalid: { label: "Bị loại khi kiểm tra", tone: "caution" },
    duplicate: { label: "Trùng", tone: "neutral" },
    limit: { label: "Vượt giới hạn 30", tone: "neutral" },
  },
  en: {
    proposed: { label: "Proposal created", tone: "positive" },
    invalid: { label: "Rejected by checks", tone: "caution" },
    duplicate: { label: "Duplicate", tone: "neutral" },
    limit: { label: "Over the limit of 30", tone: "neutral" },
  },
};
const runStatusLabels: Labels = {
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
export const requestStatuses = requestStatusLabels.vi;
export const itemOutcomes = itemOutcomeLabels.vi;
export const runStatuses = runStatusLabels.vi;
/** Unknown statuses fall back to "failed" so a new SQL value never renders as a green badge. */
export function requestStatus(status: string, locale: Locale = defaultLocale) {
  const t = requestStatusLabels[locale];
  return Object.hasOwn(t, status) ? t[status] : t.failed;
}
export function runStatus(status: string, locale: Locale = defaultLocale) {
  const t = runStatusLabels[locale];
  return Object.hasOwn(t, status) ? t[status] : t.failed;
}
/** Unknown outcomes are shown as recorded, in a neutral badge. */
export function itemOutcome(outcome: string, locale: Locale = defaultLocale): Label {
  const t = itemOutcomeLabels[locale];
  return Object.hasOwn(t, outcome) ? t[outcome] : { label: outcome, tone: "neutral" };
}
// extractor_propose() and the worker record reasons in English (SQL, Slice
// 10a). Known ones are explained in Vietnamese here; the original text stays
// visible for matching against logs. Unknown reasons are shown as recorded.
// In English the recorded reason is already readable, so it is shown as is.
const reasonRules: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Excerpt not found verbatim/, () => "Câu trích không có nguyên văn trong trang (AI chép sai hoặc tự viết)."],
  [/^Number (.+) not found in the excerpt$/, (m) => `Con số ${m[1]} không có trong câu trích (AI tự tính, đổi đơn vị hoặc nhớ nhầm).`],
  [/^Excerpt must be 20-500 characters$/, () => "Câu trích phải dài 20–500 ký tự."],
  [/^Topic not in the allowed list$/, () => "Chủ đề không nằm trong danh sách cho phép."],
  [/^Unknown country$/, () => "Quốc gia không có trong hệ thống."],
  [/^Missing or too long subject\/predicate\/value\/unit$/, () => "Thiếu hoặc quá dài: đối tượng, thuộc tính, giá trị hoặc đơn vị."],
  [/^Same subject, predicate and value already proposed/, () => "Đã có đề xuất cùng đối tượng, thuộc tính và giá trị cho tài liệu này."],
  [/^More than 30 proposals/, () => "Vượt giới hạn 30 đề xuất cho một tài liệu."],
  [/^Dates must be YYYY-MM-DD$/, () => "Ngày phải có dạng YYYY-MM-DD."],
  [/^Dates must be real calendar dates$/, () => "Ngày không tồn tại trên lịch."],
  [/^valid_until is before valid_from$/, () => "Ngày kết thúc hiệu lực trước ngày bắt đầu."],
  [/^Invalid reference period$/, () => "Kỳ số liệu không đúng dạng (2024, 2024-Q2, 2024-H1, 2024-09)."],
  [/^Confidence must be a number between 0 and 1$/, () => "Mức tự đánh giá phải là số từ 0 đến 1."],
  [/^Cancelled by an editor$/, () => "Biên tập viên đã hủy yêu cầu."],
  [/^(Run ended before this document finished|Worker stopped before finishing)$/, () => "Lần chạy dừng trước khi xử lý xong tài liệu này."],
];
export function reasonLabel(reason: string | null | undefined, locale: Locale = defaultLocale) {
  if (!reason) return null;
  if (locale === "en") return reason;
  for (const [re, f] of reasonRules) { const m = reason.match(re); if (m) return f(m); }
  return reason;
}

/** Self-reported model confidence, always labelled as such (AGENTS.md 11). */
export function confidenceLabel(value: number | string | null | undefined, locale: Locale = defaultLocale) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const pct = Math.round(n * 100);
  return locale === "en" ? `model self-assessed ${pct}%` : `mô hình tự đánh giá ${pct}%`;
}
const errors: MessageTable = {
  vi: {
  extraction_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  access_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  extraction_no_text: "Tài liệu này chưa có văn bản trích (chỉ tài liệu do crawler lấy mới có).",
  extraction_already_open: "Tài liệu đã có một yêu cầu đang chờ hoặc đang xử lý.",
  extraction_not_pending: "Yêu cầu không còn ở trạng thái chờ. Hãy tải lại trang.",
  extraction_account_unsuitable: "Tài khoản phải có quyền Đề xuất thông tin (facts.propose) và KHÔNG có quyền Duyệt đề xuất (facts.review).",
    fallback: "Không thực hiện được. Hãy tải lại trang và thử lại.",
  },
  en: {
    extraction_forbidden: "You do not have permission to do this.",
    access_forbidden: "You do not have permission to do this.",
    extraction_no_text: "This document has no extracted text yet (only documents fetched by the crawler have it).",
    extraction_already_open: "The document already has a request waiting or in progress.",
    extraction_not_pending: "The request is no longer waiting. Reload the page.",
    extraction_account_unsuitable: "The account must have Propose facts (facts.propose) and must NOT have Review proposals (facts.review).",
    fallback: "Could not complete this. Reload the page and try again.",
  },
};
export function extractionError(code: string, locale: Locale = defaultLocale) {
  return lookupMessage(errors, code, locale);
}
export type ExtractionState = { error?: string; message?: string };
