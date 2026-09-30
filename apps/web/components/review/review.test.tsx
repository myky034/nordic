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

it("lists decisions by item name with a plain label, not a code or an id", async () => {
  const { DecisionHistory } = await import("./decision-history");
  const html = renderToStaticMarkup(<DecisionHistory items={[{ id: "r1", title: "Synthetic rule", decision: "rejected", note: "Excerpt not on the page", createdAt: "2026-09-29T10:20:00Z", detail: "Trường" }]} />);
  for (const text of ["Synthetic rule", "Đã từ chối", "Excerpt not on the page", "2026-09-29 10:20 UTC · Trường"]) expect(html).toContain(text);
  expect(html).not.toContain(">rejected<");
});

it("shows the three review steps with counts, marks the current one, and never shows a failed count as zero", async () => {
  const { ReviewStepsContent: ReviewSteps } = await import("./review-steps");
  // Fake client: every table has 2 pending rows except sources, whose count fails.
  const client = { from: (table: string) => ({ select: () => ({ eq: () => Promise.resolve(table === "sources" ? { count: null, error: new Error("x") } : { count: 2, error: null }) }) }) };
  const errors = console.error; console.error = () => {};
  try {
    const html = renderToStaticMarkup(await ReviewSteps({ client: client as never, permissions: ["facts.review"], current: "immigration" }));
    for (const text of ["Xác minh nguồn", "Duyệt mục gốc", "Duyệt thông tin chi tiết", "4 chờ", "2 chờ", "—", "Người quản lý nguồn thực hiện", 'aria-current="page"']) expect(html).toContain(text);
    expect(html).not.toContain('href="/admin/sources"');
  } finally { console.error = errors; }
});

it("lists other claims from the same page, flags only same-claim ones, and says when they could not load", async () => {
  const { SamePageFacts } = await import("./same-page-facts");
  const current = { subject: "Professors", predicate: "average monthly salary" };
  const html = renderToStaticMarkup(<SamePageFacts current={current} others={[
    { id: "a", subject: "Specialist physicians", predicate: "average monthly salary", value: "1", unit: null, status: "reviewed" },
    { id: "b", subject: "professors", predicate: "Average monthly salary", value: "2", unit: null, status: "proposed" },
  ]} />);
  for (const text of ["Các thông tin khác từ cùng trang này", "cùng trang không có nghĩa là trùng", "Specialist physicians", "Có thể trùng"]) expect(html).toContain(text);
  expect(html.match(/Có thể trùng</g)?.length).toBe(1);
  expect(renderToStaticMarkup(<SamePageFacts current={current} others={[]} />)).toBe("");
  expect(renderToStaticMarkup(<SamePageFacts current={current} others={null} />)).toContain("Không tải được");
});
