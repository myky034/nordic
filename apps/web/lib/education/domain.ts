import { lookupMessage, type MessageTable } from "@/lib/i18n/messages";
import { canonicalSourceUrl, countrySlugs } from "../registry/domain";
import { uuidPattern } from "../documents/domain";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";


// Mirrors the programmes.degree_type CHECK. "unknown" exists so an operator
// never has to guess a level the source does not state.
const degreeNames = {
  vi: { bachelor: "Cử nhân", master: "Thạc sĩ", phd: "Tiến sĩ", other: "Khác", unknown: "Nguồn không nêu" },
  en: { bachelor: "Bachelor's", master: "Master's", phd: "PhD", other: "Other", unknown: "Not stated by the source" },
} as const;
export const degreeTypes = degreeNames.vi;
export type DegreeType = keyof typeof degreeTypes;
// Mirrors facts.deadline_type (SRS FR-ED-01). Rolling / year-round deadlines
// have no single date; the UI must not render one.
const deadlineNames = {
  vi: { fixed: "Ngày cố định", rolling: "Xét tuyển liên tục", year_round: "Mở quanh năm" },
  en: { fixed: "Fixed date", rolling: "Rolling admission", year_round: "Open all year" },
} as const;
export const deadlineTypes = deadlineNames.vi;
export type DeadlineType = keyof typeof deadlineTypes;
export const entityStatuses: Record<string, string> = {
  proposed: "Chờ duyệt", reviewed: "Đã duyệt bằng chứng", rejected: "Đã từ chối",
};

/** Degree levels as [value, label] pairs for filters, in the viewer's language. */
/** Deadline kinds as [value, label] pairs for the proposal form. */
export const deadlineOptions = (locale: Locale = defaultLocale) => Object.entries(deadlineNames[locale]) as [DeadlineType, string][];
export const degreeOptions = (locale: Locale = defaultLocale) => Object.entries(degreeNames[locale]) as [DegreeType, string][];
export function degreeLabel(value: string, locale: Locale = defaultLocale) {
  return degreeNames[locale][Object.hasOwn(degreeTypes, value) ? value as DegreeType : "unknown"];
}
export function deadlineLabel(value: string | null | undefined, locale: Locale = defaultLocale) {
  return value && Object.hasOwn(deadlineTypes, value) ? deadlineNames[locale][value as DeadlineType] : null;
}

type Query = Record<string, string | string[] | undefined>;
// Untrusted search params -> allowlisted filters. Anything unknown is dropped
// rather than passed to the database.
export function programmeFilters(query: Query) {
  const single = (key: string) => typeof query[key] === "string" ? (query[key] as string).trim() : "";
  const country = single("country"), degree = single("degree"), university = single("university");
  return {
    country: countrySlugs.some((slug) => slug === country) ? country : "",
    degree: Object.hasOwn(degreeTypes, degree) ? degree : "",
    university: uuidPattern.test(university) ? university.toLowerCase() : "",
    field: single("field").slice(0, 100),
  };
}

// ilike treats % and _ as wildcards; escape them so a user's search text is
// matched literally ("50%" must not match everything).
export function likePattern(text: string) {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// Same URL rules as the registry: http(s) only, no credentials, no fragment.
export function officialUrl(value: string) {
  const url = canonicalSourceUrl(value);
  return url && url.length <= 2048 ? url : null;
}

const errors: MessageTable = {
  vi: {
  education_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  access_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  education_document_missing: "Tài liệu bằng chứng không tồn tại. Hãy nhập tài liệu trước.",
  education_duplicate: "Đã có mục cùng tên (chưa bị từ chối). Không tạo bản trùng.",
  education_already_decided: "Mục này đã được xử lý. Hãy tải lại trang; không ghi đè quyết định cũ.",
  education_university_unreviewed: "Cần duyệt trường đại học trước khi duyệt chương trình của trường đó.",
  education_missing: "Mục không còn tồn tại. Hãy tải lại trang.",
    fallback: "Không lưu được. Kiểm tra các trường bắt buộc, URL và trích đoạn bằng chứng rồi thử lại.",
  },
  en: {
    education_forbidden: "You do not have permission to do this.",
    access_forbidden: "You do not have permission to do this.",
    education_document_missing: "The evidence document does not exist. Import the document first.",
    education_duplicate: "An item with the same name already exists (not rejected). No duplicate was created.",
    education_already_decided: "This item has already been decided. Reload the page; earlier decisions are never overwritten.",
    education_university_unreviewed: "Review the university before reviewing its programmes.",
    education_missing: "The item no longer exists. Reload the page.",
    fallback: "Could not save. Check the required fields, URLs and evidence excerpt, then try again.",
  },
};
export function educationError(code: string, locale: Locale = defaultLocale) {
  return lookupMessage(errors, code, locale);
}
export type EducationState = { error?: string; message?: string };
