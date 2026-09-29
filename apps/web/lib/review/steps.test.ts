import { describe, expect, it } from "vitest";
import { reviewSteps, stepLinks } from "./steps";
import { decisionLabel, decisionTime, factName } from "./history";
import { permissionName } from "../rbac/labels";

describe("review steps", () => {
  it("puts source verification first and detailed facts last", () => {
    expect(reviewSteps.map((s) => s.number)).toEqual([1, 2, 3]);
    expect(reviewSteps[0].links.map((l) => l.page)).toEqual(["sources"]);
    expect(reviewSteps[2].links.map((l) => l.page)).toEqual(["facts"]);
  });
  it("keeps a step the user cannot open, marked as not allowed", () => {
    const [sources] = stepLinks(reviewSteps[0], ["facts.review"]);
    expect(sources.allowed).toBe(false);
    expect(stepLinks(reviewSteps[0], ["sources.manage"])[0].allowed).toBe(true);
  });
});

describe("decision history", () => {
  it("shows plain labels, falling back to the raw value for unknown codes", () => {
    expect(decisionLabel("revalidated").label).toBe("Vẫn khớp nguồn mới");
    expect(decisionLabel("something_new").label).toBe("something_new");
  });
  it("states the time zone and survives bad input", () => {
    expect(decisionTime("2026-09-29T10:20:30Z")).toBe("2026-09-29 10:20 UTC");
    expect(decisionTime("not a date")).toBe("Không rõ thời gian");
  });
  it("names facts like the fact card, and says when one is not readable", () => {
    expect(factName({ subject: "Residence permit", predicate: "maintenance requirement" })).toBe("Residence permit — maintenance requirement");
    expect(factName(null)).toContain("không còn truy cập được");
  });
  it("keeps the permission key next to its plain name", () => {
    expect(permissionName("facts.review")).toBe("Duyệt đề xuất (facts.review)");
  });
});
