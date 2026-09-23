import { expect, it } from "vitest";
import { MAX_PAGE, pageParam, pageSummary, pageWindow, searchParam, withParams } from "./pagination";

it("parses page numbers defensively", () => {
  expect(pageParam({})).toBe(1);
  expect(pageParam({ page: "3" })).toBe(3);
  for (const bad of ["0", "-1", "abc", "1e3", "99999"]) expect(pageParam({ page: bad })).toBeLessThanOrEqual(MAX_PAGE);
  expect(pageParam({ page: "0" })).toBe(1);
  expect(pageParam({ page: "5000" })).toBe(MAX_PAGE);
  expect(pageParam({ page: ["2", "3"] })).toBe(1);
});
it("trims, caps and strips control characters from search text", () => {
  expect(searchParam({ q: "  kth \n" })).toBe("kth");
  expect(searchParam({ q: "a\u0000b" })).toBe("ab");
  expect(searchParam({ q: "x".repeat(300) })).toHaveLength(100);
  expect(searchParam({ q: ["a"] })).toBe("");
});
it("computes windows and summaries", () => {
  expect(pageWindow(1)).toEqual({ from: 0, to: 24, skip: 0, take: 25 });
  expect(pageWindow(3)).toEqual({ from: 50, to: 74, skip: 50, take: 25 });
  expect(pageSummary(0, 1)).toMatchObject({ pages: 1, first: 0, last: 0, hasPrev: false, hasNext: false });
  expect(pageSummary(60, 2)).toMatchObject({ pages: 3, first: 26, last: 50, hasPrev: true, hasNext: true });
  expect(pageSummary(60, 9)).toMatchObject({ current: 3, first: 51, last: 60, hasNext: false });
});
it("keeps other filters when changing one parameter", () => {
  expect(withParams("/sources", { country: "sweden", page: "2", q: "" }, { page: 3 })).toBe("/sources?country=sweden&page=3");
  expect(withParams("/sources", { country: "sweden", page: "2" }, { page: 1 })).toBe("/sources?country=sweden");
  expect(withParams("/x", {}, { status: "proposed" })).toBe("/x?status=proposed");
});
it("accepts only allowlisted tab values", async () => {
  const { choiceParam } = await import("./pagination");
  expect(choiceParam({ status: "reviewed" }, "status", ["proposed", "reviewed"] as const, "proposed")).toBe("reviewed");
  expect(choiceParam({ status: "hacked" }, "status", ["proposed", "reviewed"] as const, "proposed")).toBe("proposed");
});
it("recognises PostgREST's past-the-end range error only", async () => {
  const { isPastLastPage } = await import("./pagination");
  expect(isPastLastPage({ code: "PGRST103" })).toBe(true);
  expect(isPastLastPage({ code: "42501" })).toBe(false);
  expect(isPastLastPage(null)).toBe(false);
});
