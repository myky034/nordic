import { canonicalSourceUrl, countrySlugs } from "../registry/domain";
import { uuidPattern } from "../documents/domain";

// Mirrors the programmes.degree_type CHECK. "unknown" exists so an operator
// never has to guess a level the source does not state.
export const degreeTypes = { bachelor: "Bachelor", master: "Master", phd: "PhD", other: "Other", unknown: "Not stated" } as const;
export type DegreeType = keyof typeof degreeTypes;
// Mirrors facts.deadline_type (SRS FR-ED-01). Rolling / year-round deadlines
// have no single date; the UI must not render one.
export const deadlineTypes = { fixed: "Fixed date", rolling: "Rolling admission", year_round: "Open all year" } as const;
export type DeadlineType = keyof typeof deadlineTypes;
export const entityStatuses: Record<string, string> = {
  proposed: "Đề xuất — chưa duyệt", reviewed: "Đã duyệt bằng chứng tồn tại", rejected: "Không chấp nhận",
};

export function degreeLabel(value: string) {
  return Object.hasOwn(degreeTypes, value) ? degreeTypes[value as DegreeType] : "Not stated";
}
export function deadlineLabel(value: string | null | undefined) {
  return value && Object.hasOwn(deadlineTypes, value) ? deadlineTypes[value as DeadlineType] : null;
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

const errors: Record<string, string> = {
  education_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  access_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  education_document_missing: "Tài liệu bằng chứng không tồn tại. Hãy nhập tài liệu trước.",
  education_duplicate: "Đã có mục cùng tên (chưa bị từ chối). Không tạo bản trùng.",
  education_already_decided: "Mục này đã được xử lý. Hãy tải lại trang; không ghi đè quyết định cũ.",
  education_university_unreviewed: "Cần duyệt trường đại học trước khi duyệt chương trình của trường đó.",
  education_missing: "Mục không còn tồn tại. Hãy tải lại trang.",
};
export function educationError(code: string) {
  return errors[code] ?? "Không lưu được. Kiểm tra các trường bắt buộc, URL và trích đoạn bằng chứng rồi thử lại.";
}
export type EducationState = { error?: string; message?: string };
