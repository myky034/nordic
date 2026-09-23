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
  return "Không lưu được. Kiểm tra các trường bắt buộc, bằng chứng và ngày hiệu lực rồi thử lại.";
}
export const statuses: Record<string,string> = {
  proposed: "Đề xuất — chưa duyệt", reviewed: "Đã duyệt bằng chứng — chưa xác minh hiệu lực",
  rejected: "Không chấp nhận", conflicted: "Có mâu thuẫn — cần xem xét",
};
