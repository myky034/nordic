import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ proposeFact: async () => ({}), reviewFact: async () => ({}), resolveSourceChange: async () => ({}), setFactType: async () => ({}) }));
import { SourceChangeForm } from "./forms";

// L7a (Decision Log 2026-10-15): three outcomes for a fact whose page changed.
it("offers to move the fact when its excerpt is still in the new version", () => {
  const html = renderToStaticMarkup(<SourceChangeForm id="f1" excerptInNew={true} replacements={[]} locale="vi" />);
  expect(html).toContain("Câu trích vẫn có nguyên văn trong phiên bản mới");
  expect(html).toMatch(/<option value="revalidated" selected="">Vẫn khớp — chuyển sang phiên bản mới<\/option>/);
  // Nothing on the page can replace it yet.
  expect(html).toMatch(/<option value="superseded" disabled="">/);
});
it("cannot move a fact whose excerpt is gone, and defaults to choosing a replacing fact", () => {
  const html = renderToStaticMarkup(<SourceChangeForm id="f1" excerptInNew={false} locale="en"
    replacements={[{ id: "f2", label: "English requirement: English 6 or English level 2 (2026-10-15)" }]} />);
  expect(html).toContain("no longer in the new version");
  expect(html).toMatch(/<option value="revalidated" disabled="">/);
  expect(html).toMatch(/<option value="superseded" selected="">Replaced by a newer fact<\/option>/);
  expect(html).toContain('name="related"');
  expect(html).toContain("English 6 or English level 2 (2026-10-15)");
});
