import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ mapFact: async () => ({}) }));
vi.mock("../../workspace/actions", () => ({ proposeFact: async () => ({}), reviewFact: async () => ({}), resolveSourceChange: async () => ({}), setFactType: async () => ({}) }));
import { MapView, type MapType } from "./map-view";
import { findExcerpt } from "@/lib/facts/mapping";

// L5b: synthetic page text; the highlighted ranges come from fact excerpts.
const text = "How to apply\nOnly in the first admission round (mid-October to mid-January).\nEligibility\nEnglish 6 or English level 2.";
const english: MapType = { id: "t1", label: "Yêu cầu tiếng Anh", definition: "English requirement as stated", value_kind: "text", applies_to: "programme",
  unit_hint: null, min_value: null, max_value: null, category: "language", label_en: "English requirement" };
const render = (canPropose: boolean) => renderToStaticMarkup(<MapView documentId="d1" text={text} types={[english]} subject="MSc Synthetic"
  marks={[{ ...findExcerpt(text, "first admission round (mid-October to mid-January)")!, status: "proposed" }, { ...findExcerpt(text, "English 6 or English level 2")!, status: "reviewed" }]}
  needsCountry={false} countries={[]} canPropose={canPropose} aside={<p>aside</p>} locale="vi" />);

it("shows the whole page text with proposed and reviewed passages highlighted, as offset-tagged spans", () => {
  const html = render(true);
  expect(html.replace(/<[^>]+>/g, "")).toContain(text.replace(/&/g, "&amp;"));
  expect(html).toMatch(/<span data-start="\d+" class="rounded bg-caution\/20">first admission round \(mid-October to mid-January\)<\/span>/);
  expect(html).toMatch(/class="rounded bg-positive\/15">English 6 or English level 2<\/span>/);
  expect(html).toContain('data-start="0"');
  // Nothing selected yet: a prompt, no form.
  expect(html).toContain("Bôi đen một đoạn");
  expect(html).not.toContain('name="excerpt"');
  expect(html).toContain("aside");
});
it("hides the mapping form from reviewers who cannot propose", () => {
  const html = render(false);
  expect(html).not.toContain("Ghép đoạn đã chọn");
  expect(html).toContain("aside");
});
