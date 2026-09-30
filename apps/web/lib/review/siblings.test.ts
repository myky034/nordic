import { expect, it } from "vitest";
import { isSameClaim, sameDocumentClaims, type Sibling } from "./siblings";

const s = (id: string, subject: string, predicate: string, status = "reviewed"): Sibling => ({ id, subject, predicate, value: "1", unit: null, status });

it("treats the same subject and predicate as the same claim, ignoring case and spacing", () => {
  expect(isSameClaim({ subject: "Residence permit ", predicate: "Maintenance requirement" }, { subject: "residence  permit", predicate: "maintenance requirement" })).toBe(true);
});
it("does not treat different claims from the same page as duplicates", () => {
  expect(isSameClaim({ subject: "Professors", predicate: "average monthly salary" }, { subject: "Specialist physicians", predicate: "average monthly salary" })).toBe(false);
  expect(isSameClaim({ subject: "Residence permit", predicate: "admission requirement" }, { subject: "Residence permit", predicate: "maintenance requirement" })).toBe(false);
});
it("lists possible duplicates first and leaves rejected claims out", () => {
  const rows = sameDocumentClaims({ subject: "A", predicate: "p" }, [s("1", "B", "p"), s("2", "A", "p", "proposed"), s("3", "A", "p", "rejected")]);
  expect(rows.map((r) => [r.id, r.possibleDuplicate])).toEqual([["2", true], ["1", false]]);
});
