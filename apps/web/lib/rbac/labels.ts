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

/** Permissions grouped by area, in the order the role editor shows them. */
export const permissionGroups: { title: string; keys: PermissionKey[] }[] = [
  { title: "Thông tin và duyệt", keys: ["facts.propose", "facts.review"] },
  { title: "Dữ liệu chuyên mục", keys: ["education.manage", "immigration.manage", "labour.manage", "metrics.manage"] },
  { title: "Nguồn và tài liệu", keys: ["sources.manage", "documents.read", "documents.ingest", "crawler.manage"] },
  { title: "Quản trị", keys: ["roles.manage", "users.assign_roles"] },
];

// access_audit.action codes written by the RBAC, crawler, extraction and
// metrics migrations. Unknown codes are shown as stored.
const auditActions: Record<string, string> = {
  "role.saved": "Lưu vai trò",
  "role.granted": "Gán vai trò",
  "role.revoked": "Gỡ vai trò",
  "bootstrap": "Tạo quản trị viên đầu tiên",
  "crawl_target.saved": "Lưu URL crawl",
  "extraction.account_set": "Đặt tài khoản AI",
  "metric.saved": "Lưu chỉ số so sánh",
};
export function auditActionLabel(action: string) {
  return auditActions[action] ?? action;
}
