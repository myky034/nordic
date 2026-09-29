import type { PermissionKey } from "./access";

// Plain Vietnamese names for permissions. The key stays next to the name where
// an administrator must find it on /admin/access, so both are shown there.
export const permissionLabels: Record<PermissionKey, string> = {
  "facts.propose": "Đề xuất thông tin",
  "facts.review": "Duyệt đề xuất",
  "documents.read": "Xem tài liệu",
  "documents.ingest": "Nhập tài liệu",
  "users.assign_roles": "Gán vai trò cho người dùng",
  "roles.manage": "Quản lý vai trò",
  "sources.manage": "Quản lý nguồn",
  "education.manage": "Đề xuất trường & chương trình",
  "immigration.manage": "Đề xuất quy định nhập cư",
  "labour.manage": "Đề xuất nghề",
  "metrics.manage": "Quản lý chỉ số so sánh",
  "crawler.manage": "Quản lý crawler",
};

/** "Duyệt đề xuất (facts.review)" — readable, and still searchable on the access page. */
export function permissionName(key: PermissionKey) {
  return `${permissionLabels[key]} (${key})`;
}
