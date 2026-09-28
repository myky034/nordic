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
  extraction_account_unsuitable: "Tài khoản phải có facts.propose và KHÔNG có facts.review.",
};
export function extractionError(code: string) {
  return errors[code] ?? "Không thực hiện được. Hãy tải lại trang và thử lại.";
}
export type ExtractionState = { error?: string; message?: string };
