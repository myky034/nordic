// Mirrors occupations.classification_system. A code is stored only when the
// source states one; there is deliberately no "guessed" option.
export const classificationSystems = { "ISCO-08": "ISCO-08", ESCO: "ESCO", national: "National classification", other: "Other" } as const;
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

export function classificationLabel(system: string | null, code: string | null) {
  return system && code ? `${system} ${code}` : "No classification code recorded";
}

const errors: Record<string, string> = {
  labour_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  access_forbidden: "Bạn chưa có quyền thực hiện thao tác này.",
  labour_document_missing: "Tài liệu bằng chứng không tồn tại. Hãy nhập tài liệu trước.",
  labour_duplicate: "Đã có nghề cùng tên (chưa bị từ chối) trong cùng phạm vi quốc gia.",
  labour_already_decided: "Mục này đã được xử lý. Hãy tải lại trang; không ghi đè quyết định cũ.",
  labour_missing: "Nghề không còn tồn tại. Hãy tải lại trang.",
};
export function labourError(code: string) {
  return errors[code] ?? "Không lưu được. Kiểm tra tên, mã phân loại (phải đi kèm hệ phân loại) và trích đoạn bằng chứng.";
}
export type LabourState = { error?: string; message?: string };
