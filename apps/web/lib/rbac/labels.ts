import type { PermissionKey } from "./access";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";

// Plain names for permissions, per interface language. The key stays next to
// the name where an administrator must find it on /admin/access, so both are
// shown there.
const labels: Record<Locale, Record<PermissionKey, string>> = {
  vi: {
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
    "taxonomy.manage": "Quản lý hướng nghề",
  },
  en: {
    "facts.propose": "Propose facts",
    "facts.review": "Review proposals",
    "documents.read": "Read documents",
    "documents.ingest": "Import documents",
    "users.assign_roles": "Assign roles to users",
    "roles.manage": "Manage roles",
    "sources.manage": "Manage sources",
    "education.manage": "Propose universities & programmes",
    "immigration.manage": "Propose immigration rules",
    "labour.manage": "Propose occupations",
    "metrics.manage": "Manage comparison metrics",
    "crawler.manage": "Manage crawler",
    "taxonomy.manage": "Manage career paths",
  },
};
/** Vietnamese table, kept for existing callers. */
export const permissionLabels = labels.vi;

/** Name of a permission in the viewer's language; unknown keys are shown as stored. */
export function permissionLabel(key: string, locale: Locale = defaultLocale) {
  const t = labels[locale];
  return Object.hasOwn(t, key) ? t[key as PermissionKey] : key;
}

/** "Duyệt đề xuất (facts.review)" — readable, and still searchable on the access page. */
export function permissionName(key: PermissionKey, locale: Locale = defaultLocale) {
  return `${labels[locale][key]} (${key})`;
}

const groupKeys: PermissionKey[][] = [
  ["facts.propose", "facts.review"],
  ["education.manage", "immigration.manage", "labour.manage", "metrics.manage", "taxonomy.manage"],
  ["sources.manage", "documents.read", "documents.ingest", "crawler.manage"],
  ["roles.manage", "users.assign_roles"],
];
const groupTitles: Record<Locale, string[]> = {
  vi: ["Thông tin và duyệt", "Dữ liệu chuyên mục", "Nguồn và tài liệu", "Quản trị"],
  en: ["Facts and review", "Topic data", "Sources and documents", "Administration"],
};
/** Title of the group for permissions no group lists (added later in SQL). */
export const otherGroupTitle: Record<Locale, string> = { vi: "Khác", en: "Other" };

/** Permissions grouped by area, in the order the role editor shows them. */
export function localizedPermissionGroups(locale: Locale = defaultLocale): { title: string; keys: PermissionKey[] }[] {
  return groupKeys.map((keys, i) => ({ title: groupTitles[locale][i], keys }));
}
export const permissionGroups = localizedPermissionGroups("vi");

// access_audit.action codes written by the RBAC, crawler, extraction and
// metrics migrations. Unknown codes are shown as stored.
const auditActions: Record<Locale, Record<string, string>> = {
  vi: {
    "role.saved": "Lưu vai trò",
    "role.granted": "Gán vai trò",
    "role.revoked": "Gỡ vai trò",
    "bootstrap": "Tạo quản trị viên đầu tiên",
    "crawl_target.saved": "Lưu URL crawl",
    "extraction.account_set": "Đặt tài khoản AI",
    "metric.saved": "Lưu chỉ số so sánh",
    "career_path.saved": "Lưu hướng nghề",
    "study_fields.imported": "Nhập danh mục ngành ISCED-F",
  },
  en: {
    "role.saved": "Role saved",
    "role.granted": "Role granted",
    "role.revoked": "Role revoked",
    "bootstrap": "First administrator created",
    "crawl_target.saved": "Crawl URL saved",
    "extraction.account_set": "AI account set",
    "metric.saved": "Comparison metric saved",
    "career_path.saved": "Career path saved",
    "study_fields.imported": "ISCED-F field list imported",
  },
};
export function auditActionLabel(action: string, locale: Locale = defaultLocale) {
  const t = auditActions[locale];
  return Object.hasOwn(t, action) ? t[action] : action;
}
