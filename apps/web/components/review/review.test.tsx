import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ReviewPanel } from "./review-panel";
import { VisibilityNote } from "./visibility-note";

const noop = async () => ({});

it("asks for an explicit decision: two submit buttons, no preselected option", () => {
  const html = renderToStaticMarkup(<ReviewPanel action={noop} hidden={{ id: "x" }} checks={["Trích đoạn có nguyên văn"]} />);
  const buttons = html.match(/<button[^>]*>/g) ?? [];
  for (const value of ["reviewed", "rejected"]) {
    expect(buttons.some((b) => b.includes('type="submit"') && b.includes(`value="${value}"`) && b.includes('name="decision"'))).toBe(true);
  }
  expect(html).not.toContain("<select");
  expect(html).toMatch(/<textarea[^>]*name="note"[^>]*required/);
  for (const text of ["Quyết định của bạn", "Trích đoạn có nguyên văn", "Duyệt", "Từ chối", 'name="id" value="x"']) expect(html).toContain(text);
});

it("explains why a reviewed record is hidden and links to source verification", () => {
  const html = renderToStaticMarkup(<VisibilityNote visibility={{ state: "hidden", blockers: ["rule_source_unverified"] }} />);
  for (const text of ["Đã duyệt nhưng chưa hiển thị công khai", "chưa được xác minh", 'href="/admin/sources"']) expect(html).toContain(text);
});

it("warns before review when the record would stay hidden, without a registry link for non-source reasons", () => {
  const html = renderToStaticMarkup(<VisibilityNote visibility={{ state: "will_stay_hidden", blockers: ["university_not_reviewed"] }} />);
  expect(html).toContain("kể cả khi duyệt");
  expect(html).not.toContain("/admin/sources");
});

it("never claims a record is public when the check failed", () => {
  const html = renderToStaticMarkup(<VisibilityNote visibility={{ state: "unknown" }} />);
  expect(html).toContain("Không kiểm tra được");
  expect(html).not.toContain("Đang hiển thị công khai");
});
