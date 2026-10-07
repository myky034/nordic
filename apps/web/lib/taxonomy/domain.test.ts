import { expect, it } from "vitest";
import { buildFieldTree, careerPathName, filterFields, fold, parseKeywords, studyFieldName, taxonomyError } from "./domain";

// Synthetic rows shaped like ISCED-F codes; no real data needed for the rules.
const rows = [
  { id: "a", code: "06", level: 1, parent_id: null, name_en: "Information and Communication Technologies (ICTs)", name_vi: "Công nghệ thông tin và truyền thông (ICT)" },
  { id: "b", code: "061", level: 2, parent_id: "a", name_en: "Information and Communication Technologies (ICTs)", name_vi: "Công nghệ thông tin và truyền thông (ICT)" },
  { id: "c", code: "0613", level: 3, parent_id: "b", name_en: "Software and applications development and analysis", name_vi: "Phát triển và phân tích phần mềm và ứng dụng" },
  { id: "d", code: "0612", level: 3, parent_id: "b", name_en: "Database and network design and administration", name_vi: "Thiết kế và quản trị cơ sở dữ liệu và mạng" },
  { id: "e", code: "04", level: 1, parent_id: null, name_en: "Business, administration and law", name_vi: "Kinh doanh, quản lý và luật" },
];

it("builds the tree in code order", () => {
  const tree = buildFieldTree(rows);
  expect(tree.map((n) => n.code)).toEqual(["04", "06"]);
  expect(tree[1].children[0].children.map((n) => n.code)).toEqual(["0612", "0613"]);
});
it("finds fields by code prefix or by words in either language, accents optional, keeping ancestors", () => {
  expect(filterFields(rows, "0613").map((r) => r.code)).toEqual(["06", "061", "0613"]);
  expect(filterFields(rows, "phan mem").map((r) => r.code)).toEqual(["06", "061", "0613"]);
  expect(filterFields(rows, "SOFTWARE analysis").map((r) => r.code)).toEqual(["06", "061", "0613"]);
  expect(filterFields(rows, "nothing like this")).toEqual([]);
  expect(filterFields(rows, "  ")).toHaveLength(rows.length);
  expect(fold("Quản lý Đào tạo")).toBe("quan ly dao tao");
});
it("shows UNESCO's English name in English and Nordic's translation in Vietnamese", () => {
  expect(studyFieldName(rows[2], "en")).toBe("Software and applications development and analysis");
  expect(studyFieldName(rows[2])).toBe("Phát triển và phân tích phần mềm và ứng dụng");
  expect(careerPathName({ name_vi: "Phân tích nghiệp vụ", name_en: "Business analysis" }, "en")).toBe("Business analysis");
});
it("reads keywords one per line or comma-separated, without blanks or case duplicates", () => {
  expect(parseKeywords("product management\n Agile ,agile,, scrum\n\n")).toEqual(["product management", "Agile", "scrum"]);
});
it("explains database refusals in both languages, unknown codes included", () => {
  expect(taxonomyError("taxonomy_immutable", "en")).toBe("The key of an existing career path cannot be changed.");
  expect(taxonomyError("constructor")).toContain("Không lưu được");
});
