// Explicit allowlist; raw database/Auth errors may contain personal information.
const messages: Record<string, string> = {
  rbac_forbidden: "Bạn không có quyền thực hiện thao tác này.",
  access_forbidden: "Bạn không có quyền thực hiện thao tác này.",
  access_unauthenticated: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
  rbac_cannot_delegate: "Bạn chỉ được quản lý hoặc cấp các quyền mà mình đang có.",
  rbac_self_assignment: "Không thể tự thay đổi vai trò của chính mình. Hãy nhờ quản trị viên khác.",
  rbac_last_admin: "Thay đổi này sẽ làm mất quản trị viên cuối cùng. Hãy cấp quyền quản trị cho người khác trước.",
  rbac_not_found: "Người dùng hoặc vai trò không còn tồn tại. Hãy tải lại trang.",
  rbac_invalid: "Dữ liệu phân quyền không hợp lệ.",
  "23505": "Tên vai trò đã tồn tại.",
  metadata_conflict: "Tài liệu đã tồn tại nhưng metadata mâu thuẫn. Bản cũ được giữ nguyên để kiểm tra.",
  source_url_mismatch: "URL tài liệu phải cùng giao thức và tên miền với nguồn đã chọn.",
  source_blocked: "Nguồn này đang bị chặn nhập tài liệu.",
  invalid_timestamp: "Ngày giờ phải hợp lệ và không nằm trong tương lai.",
  invalid_date_order: "Ngày xuất bản/cập nhật không được sau ngày thu thập.",
  sources_forbidden: "Bạn không có quyền quản lý nguồn (cần sources.manage).",
  sources_invalid: "Dữ liệu nguồn không hợp lệ. Kiểm tra tên và URL (phải là http/https).",
  sources_verification_requires_notes: "Đánh dấu 'verified' cần ghi rõ authority notes: bạn đã xác minh nguồn này như thế nào.",
  sources_crawl_requires_approval: "Chỉ bật crawl khi crawl policy = approved và status = verified.",
  sources_not_found: "Nguồn không còn tồn tại. Hãy tải lại trang.",
};
export function accessMessage(code: string) { return messages[code] ?? "Không thể hoàn tất thao tác. Kiểm tra dữ liệu hoặc thử lại sau."; }
export type ActionState = { error?: string; message?: string; documentId?: string };
