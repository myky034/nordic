export type FactState = { error?: string; message?: string };
export function validity(from: string | null, until: string | null, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  if (from && from > today) return "Chưa đến thời gian áp dụng được ghi nhận";
  if (until && until < today) return "Đã quá thời hạn được ghi nhận";
  return "Hiệu lực hiện tại chưa được xác minh";
}
export function factError(code: string) {
  if (code === "facts_forbidden" || code === "access_forbidden") return "Bạn chưa có quyền thực hiện thao tác này.";
  if (code === "facts_already_decided") return "Đề xuất đã được xử lý. Hãy tải lại trang; không ghi đè quyết định cũ.";
  if (code === "facts_conflict_requires_review") return "Chỉ đánh dấu mâu thuẫn giữa hai thông tin đã được duyệt bằng chứng. Hãy duyệt hoặc từ chối đề xuất trước.";
  if (code === "facts_country_required") return "Số liệu gắn với một nghề phải có quốc gia. Hãy chọn quốc gia mà số liệu mô tả.";
  if (code === "facts_invalid_period") return "Kỳ số liệu phải có dạng 2024, 2024-Q2, 2024-H1 hoặc 2024-09.";
  if (code === "facts_country_mismatch") return "Quốc gia đã chọn khác quốc gia của trường/chương trình. Bỏ trống quốc gia hoặc chọn đúng.";
  return "Không lưu được. Kiểm tra các trường bắt buộc, bằng chứng và ngày hiệu lực rồi thử lại.";
}
export const statuses: Record<string,string> = {
  proposed: "Đề xuất — chưa duyệt", reviewed: "Đã duyệt bằng chứng — chưa xác minh hiệu lực",
  rejected: "Không chấp nhận", conflicted: "Có mâu thuẫn — cần xem xét",
};
