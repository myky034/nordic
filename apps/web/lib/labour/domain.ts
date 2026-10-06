import { lookupMessage, type MessageTable } from "@/lib/i18n/messages";
// Mirrors occupations.classification_system. A code is stored only when the
// source states one; there is deliberately no "guessed" option.
import { defaultLocale, type Locale } from "@/lib/i18n/locales";
export const classificationSystems = { "ISCO-08": "ISCO-08", ESCO: "ESCO", national: "Phân loại quốc gia", other: "Khác" } as const;
export type ClassificationSystem = keyof typeof classificationSystems;

// Mirrors the facts.reference_period CHECK: YYYY, YYYY-Qn, YYYY-Hn or YYYY-MM.
export const referencePeriodPattern = /^[0-9]{4}(-(Q[1-4]|H[12]|0[1-9]|1[0-2]))?$/;
export function isReferencePeriod(value: string) {
  return referencePeriodPattern.test(value);
}

// PROJECT_SPEC.md Section 7: for labour market, official statistics / labour
// agencies / EURES (T1, T2) rank above professional and personal sources.
// Other tiers are shown but labelled as not official statistics.
export function isOfficialStatisticsTier(tier: string | null | undefined) {
  return tier === "T1" || tier === "T2";
}

const classificationNames = {
  vi: classificationSystems,
  en: { "ISCO-08": "ISCO-08", ESCO: "ESCO", national: "National classification", other: "Other" },
} as const;
/** Classification systems as [value, label] pairs for the occupation form. */
export const classificationOptions = (locale: Locale = defaultLocale) => Object.entries(classificationNames[locale]);
const classificationText = {
  vi: { national: "Mã quốc gia", none: "Chưa ghi nhận mã phân loại" },
  en: { national: "National code", none: "No classification code recorded" },
} as const;
export function classificationLabel(system: string | null, code: string | null, locale: Locale = defaultLocale) {
  // "national" is our category, not a name a reader would recognise; ISCO-08 / ESCO are shown as is.
  const t = classificationText[locale];
  return system && code ? `${system === "national" ? t.national : system} ${code}` : t.none;
}

const errors: MessageTable = {
  vi: {
  labour_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  access_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  labour_document_missing: "Tài liệu bằng chứng không tồn tại. Hãy nhập tài liệu trước.",
  labour_duplicate: "Đã có nghề cùng tên (chưa bị từ chối) trong cùng phạm vi quốc gia.",
  labour_already_decided: "Mục này đã được xử lý. Hãy tải lại trang; không ghi đè quyết định cũ.",
  labour_missing: "Nghề không còn tồn tại. Hãy tải lại trang.",
    fallback: "Không lưu được. Kiểm tra tên, mã phân loại (phải đi kèm hệ phân loại) và trích đoạn bằng chứng.",
  },
  en: {
    labour_forbidden: "You do not have permission to do this.",
    access_forbidden: "You do not have permission to do this.",
    labour_document_missing: "The evidence document does not exist. Import the document first.",
    labour_duplicate: "An occupation with the same name already exists (not rejected) in the same country scope.",
    labour_already_decided: "This item has already been decided. Reload the page; earlier decisions are never overwritten.",
    labour_missing: "The occupation no longer exists. Reload the page.",
    fallback: "Could not save. Check the name, the classification code (it needs a classification system) and the evidence excerpt.",
  },
};
export function labourError(code: string, locale: Locale = defaultLocale) {
  return lookupMessage(errors, code, locale);
}
export type LabourState = { error?: string; message?: string };
