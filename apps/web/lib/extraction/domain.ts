import type { Tone } from "@/components/ui";

// Presentation rules for AI extraction (Slice 10a). Labels only; every rule
// that decides what becomes a proposal lives in extractor_propose() (SQL).
type Label = { label: string; tone: Tone };
export const requestStatuses: Record<string, Label> = {
  pending: { label: "Đang chờ lần chạy tới", tone: "accent" },
  running: { label: "Đang xử lý", tone: "accent" },
  done: { label: "Đã xong", tone: "positive" },
  failed: { label: "Lỗi", tone: "critical" },
  cancelled: { label: "Đã hủy", tone: "neutral" },
};
export const itemOutcomes: Record<string, Label> = {
  proposed: { label: "Đã tạo đề xuất", tone: "positive" },
  invalid: { label: "Bị loại khi kiểm tra", tone: "caution" },
  duplicate: { label: "Trùng", tone: "neutral" },
  limit: { label: "Vượt giới hạn 30", tone: "neutral" },
};
export const runStatuses: Record<string, Label> = {
  running: { label: "Đang chạy", tone: "accent" }, succeeded: { label: "Thành công", tone: "positive" },
  partial: { label: "Có lỗi một phần", tone: "caution" }, failed: { label: "Thất bại", tone: "critical" },
};
// extractor_propose() and the worker record reasons in English (SQL, Slice
// 10a). Known ones are explained in Vietnamese here; the original text stays
// visible for matching against logs. Unknown reasons are shown as recorded.
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
export function reasonLabel(reason: string | null | undefined) {
  if (!reason) return null;
  for (const [re, f] of reasonRules) { const m = reason.match(re); if (m) return f(m); }
  return reason;
}

/** Self-reported model confidence, always labelled as such (AGENTS.md 11). */
export function confidenceLabel(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? `mô hình tự đánh giá ${Math.round(n * 100)}%` : null;
}
const errors: Record<string, string> = {
  extraction_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  access_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  extraction_no_text: "Tài liệu này chưa có văn bản trích (chỉ tài liệu do crawler lấy mới có).",
  extraction_already_open: "Tài liệu đã có một yêu cầu đang chờ hoặc đang xử lý.",
  extraction_not_pending: "Yêu cầu không còn ở trạng thái chờ. Hãy tải lại trang.",
  extraction_account_unsuitable: "Tài khoản phải có quyền Đề xuất thông tin (facts.propose) và KHÔNG có quyền Duyệt đề xuất (facts.review).",
};
export function extractionError(code: string) {
  return errors[code] ?? "Không thực hiện được. Hãy tải lại trang và thử lại.";
}
export type ExtractionState = { error?: string; message?: string };
