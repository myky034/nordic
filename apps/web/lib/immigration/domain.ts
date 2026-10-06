import { countrySlugs } from "../registry/domain";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";


// Mirrors immigration_rules.rule_type. "other" exists so an operator never has
// to force a rule into a category the source does not use.
const ruleTypeNames = {
  vi: {
    student_residence_permit: "Giấy phép cư trú du học",
    work_permit: "Giấy phép lao động",
    post_study: "Ở lại sau khi học",
    permanent_residence: "Thường trú",
    citizenship: "Quốc tịch",
    other: "Khác",
  },
  en: {
    student_residence_permit: "Student residence permit",
    work_permit: "Work permit",
    post_study: "Staying after studies",
    permanent_residence: "Permanent residence",
    citizenship: "Citizenship",
    other: "Other",
  },
} as const;
export const ruleTypes = ruleTypeNames.vi;
export type RuleType = keyof typeof ruleTypes;
/** Rule types as [value, label] pairs for filters, in the viewer's language. */
export const ruleTypeOptions = (locale: Locale = defaultLocale) => Object.entries(ruleTypeNames[locale]) as [RuleType, string][];
export function ruleTypeLabel(value: string, locale: Locale = defaultLocale) {
  return ruleTypeNames[locale][Object.hasOwn(ruleTypes, value) ? value as RuleType : "other"];
}

// AGENTS.md Section 10: only T1 evidence counts as the official/authoritative
// source for immigration. Everything else is shown, but labelled.
export function isOfficialTier(tier: string | null | undefined) {
  return tier === "T1";
}

type Query = Record<string, string | string[] | undefined>;
export function immigrationFilters(query: Query) {
  const single = (key: string) => typeof query[key] === "string" ? (query[key] as string).trim() : "";
  const country = single("country"), type = single("type");
  return {
    country: countrySlugs.some((slug) => slug === country) ? country : "",
    type: Object.hasOwn(ruleTypes, type) ? type : "",
  };
}

const errors: Record<string, string> = {
  immigration_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  access_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  immigration_document_missing: "Tài liệu bằng chứng không tồn tại. Hãy nhập tài liệu trước.",
  immigration_requires_t1: "Quy định nhập cư phải được chứng minh bằng tài liệu từ nguồn T1 (cơ quan chính phủ).",
  immigration_source_country_mismatch: "Nguồn T1 của tài liệu phải được gán đúng quốc gia của quy định (kiểm tra ở Source Registry).",
  immigration_url_not_authority: "Trang chính thức của quy định phải nằm trên cùng domain với nguồn T1 của tài liệu.",
  immigration_duplicate: "Đã có quy định cùng loại và cùng tên (chưa bị từ chối) cho quốc gia này.",
  immigration_already_decided: "Quy định đã được xử lý. Hãy tải lại trang; không ghi đè quyết định cũ.",
  immigration_missing: "Quy định không còn tồn tại. Hãy tải lại trang.",
};
export function immigrationError(code: string) {
  return errors[code] ?? "Không lưu được. Kiểm tra các trường bắt buộc, URL và trích đoạn bằng chứng rồi thử lại.";
}
export type ImmigrationState = { error?: string; message?: string };
