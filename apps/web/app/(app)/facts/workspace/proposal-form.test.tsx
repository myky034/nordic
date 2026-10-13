import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ proposeFact: async () => ({}), reviewFact: async () => ({}), resolveSourceChange: async () => ({}), markConflict: async () => ({}) }));
import { ProposalForm, type FormFactType } from "./forms";

// L3a: synthetic fact types; the list follows the linked item, so with no
// item only country types are offered.
const type = (id: string, applies_to: string, value_kind: string, label: string): FormFactType =>
  ({ id, label, definition: `${label} definition`, value_kind, applies_to, unit_hint: null, min_value: null, max_value: null });
it("offers only the fact types that fit the linked item (none linked → country types)", () => {
  const html = renderToStaticMarkup(<ProposalForm locale="vi" documents={[{ id: "d", title: "Doc" }]} countries={[]} selected="d"
    entities={[{ value: "programme:p1", label: "Chương trình: MSc Synthetic" }]}
    metrics={[type("a", "country", "money", "Mức chứng minh tài chính"), type("b", "programme", "money", "Học phí")]} />);
  expect(html).toContain("Mức chứng minh tài chính");
  expect(html).not.toContain(">Học phí<");
  expect(html).toContain('name="factType"');
  // Structured fields appear only once a type is chosen.
  expect(html).not.toContain('name="valueNumber"');
});
