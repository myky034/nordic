import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ proposeFact: async () => ({}), reviewFact: async () => ({}), resolveSourceChange: async () => ({}), setFactType: async () => ({}) }));
import { FactTypeForm, type FormFactType } from "./forms";

// L4 Q3: synthetic types; the reviewer picks among the ones that fit the fact.
const duration: FormFactType = { id: "t1", label: "Thời lượng", definition: "Length of the programme", value_kind: "number", applies_to: "programme",
  unit_hint: "tháng", min_value: "1", max_value: "120" };
it("shows the current type, the AI adjustments, and an optional number for the chosen type", () => {
  const html = renderToStaticMarkup(<FactTypeForm locale="vi" types={[duration]} currentLabel="Thời lượng"
    fact={{ id: "f1", fact_type_id: "t1", value_number: null }} adjustments={["Bỏ con số 24: câu trích không có số này (AI tự tính hoặc đổi đơn vị)."]} />);
  expect(html).toContain("Hiện tại: Thời lượng");
  expect(html).toContain("Bỏ con số 24");
  expect(html).toContain('name="valueNumber"');
  // L4 Q1: the number is optional.
  expect(html).not.toMatch(/name="valueNumber"[^>]*required/);
  expect(html).toContain("Không bắt buộc");
});
it("starts with no structured fields when the fact has no type yet", () => {
  const html = renderToStaticMarkup(<FactTypeForm locale="en" types={[duration]} currentLabel={null} fact={{ id: "f1" }} />);
  expect(html).toContain("No type yet");
  expect(html).not.toContain('name="valueNumber"');
  expect(html).not.toContain("dropped parts");
});
