import { expect, it } from "vitest";
import { countLine, groupLabel, latestReview, openGroup, questionGroups, readQuestionGroup, topicFilter } from "./overview";

it("reads only known question groups", () => {
  expect(readQuestionGroup("permits")).toBe("permits");
  expect(readQuestionGroup("other")).toBe("other");
  expect(readQuestionGroup("toString")).toBeNull();
  expect(readQuestionGroup(undefined)).toBeNull();
  expect(groupLabel("cost")).toBe("Học phí & chi phí");
});

it("puts every topic in exactly one group: listed topics in theirs, everything else in 'other'", () => {
  expect(topicFilter("cost")).toEqual({ in: ["tuition", "scholarship", "living_cost", "housing"] });
  const other = topicFilter("other");
  expect("notIn" in other && other.notIn).toEqual(expect.arrayContaining(["tuition", "immigration", "labour_market", "deadline"]));
  const all = questionGroups.flatMap((g) => [...g.topics]);
  expect(new Set(all).size).toBe(all.length);
});

it("words a zero as 'not reviewed yet' and a failed count as unknown, never as a number", () => {
  const truong = (s: string) => `${s} trường`;
  expect(countLine(4, truong, "Chưa có trường nào được duyệt")).toBe("4 trường");
  expect(countLine(1200, (s) => `${s} số liệu`, "x")).toBe("1.200 số liệu");
  expect(countLine(0, truong, "Chưa có trường nào được duyệt")).toBe("Chưa có trường nào được duyệt");
  expect(countLine(null, truong, "x")).toBe("Không tải được số liệu");
  // English: own plural and number format.
  const uni = (s: string, n: number) => `${s} ${n === 1 ? "university" : "universities"}`;
  expect(countLine(1, uni, "x", "en")).toBe("1 university");
  expect(countLine(1200, uni, "x", "en")).toBe("1,200 universities");
  expect(countLine(null, uni, "x", "en")).toBe("Could not load the count");
});

it("picks the latest review date and says nothing when none exists", () => {
  expect(latestReview(["2026-09-20T10:00:00Z", null, "2026-09-30T08:00:00Z"])).toBe("2026-09-30");
  expect(latestReview([null, undefined])).toBeNull();
});

it("opens the asked tab, else the first question with content, else the first question", () => {
  expect(openGroup("work", { permits: 3 })).toBe("work");
  expect(openGroup(undefined, { cost: 0, admission: 0, permits: 4, work: 3 })).toBe("permits");
  expect(openGroup("bogus", { other: 2 })).toBe("other");
  expect(openGroup(undefined, {})).toBe("cost");
});
