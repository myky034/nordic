import { expect, it } from "vitest";
import { expandToLines, findExcerpt, programmeChecklist, segments, topicForCategory } from "./mapping";

const page = "How to apply\nIt is only possible to apply in the first admission round\n(mid-October to mid-January).\nInformation\n60 credits\nProgramme code: SPROM";

it("finds an excerpt across line breaks and case, and returns offsets in the original text", () => {
  const r = findExcerpt(page, "first admission round (mid-October to mid-January)")!;
  expect(page.slice(r.start, r.end)).toBe("first admission round\n(mid-October to mid-January)");
  expect(findExcerpt(page, "PROGRAMME CODE: sprom")).not.toBeNull();
  expect(findExcerpt(page, "second admission round")).toBeNull();
  expect(findExcerpt(page, "   ")).toBeNull();
});
it("splits the text into plain and marked segments that cover every character once", () => {
  const a = findExcerpt(page, "60 credits")!, b = findExcerpt(page, "60 credits Programme code")!;
  // Same start: the mark given first keeps the overlap; the other keeps what is left.
  const segs = segments(page, [{ range: a, mark: "a" }, { range: b, mark: "b" }]);
  expect(segs.map((s) => s.text).join("")).toBe(page);
  expect(segs.filter((s) => s.mark).map((s) => [s.mark, s.text])).toEqual([["a", "60 credits"], ["b", "\nProgramme code"]]);
});
it("widens a short selection to whole lines, within 500 characters", () => {
  const r = findExcerpt(page, "60 credits")!;
  const wide = expandToLines(page, r);
  expect(page.slice(wide.start, wide.end)).toBe("60 credits\nProgramme code: SPROM");
  const long = "x".repeat(800);
  expect(expandToLines(long, { start: 10, end: 20 })).toEqual({ start: 10, end: 510 });
});
it("marks each key-information slot reviewed, proposed or missing, ignoring rejected facts", () => {
  const f = (id: string, key: string, status: string) => ({ id, status, value: id, fact_types: { key } });
  const list = programmeChecklist([f("a", "tuition_fee", "rejected"), f("b", "english_requirement", "proposed"),
    f("c", "min_ielts_overall", "reviewed"), f("d", "application_period", "proposed")]);
  const state = Object.fromEntries(list.map((s) => [s.key, s.state]));
  expect(state.tuition_fee).toBe("missing");
  expect(state.english_requirement).toBe("reviewed");
  expect(state.application_deadline).toBe("proposed");
});
it("pre-fills the topic from the fact type's category", () => {
  expect(topicForCategory("tuition")).toBe("tuition");
  expect(topicForCategory("quality_of_life")).toBe("other");
  expect(topicForCategory(null)).toBe("other");
});
