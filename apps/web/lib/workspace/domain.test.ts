import { expect, it } from "vitest";
import { describeItem, isItemKind, parseBudget, parseYear, workspaceError } from "./domain";

it("recognises only known item kinds", () => {
  expect(isItemKind("programme")).toBe(true);
  for (const bad of ["fact", "users", "", null, "__proto__"]) expect(isItemKind(bad)).toBe(false);
});
it("resolves an embedded item to a label and link", () => {
  expect(describeItem({ countries: { id: "c", slug: "sweden", name: "Sweden" } })).toEqual({ kind: "country", id: "c", title: "Sweden", href: "/countries/sweden" });
  expect(describeItem({ immigration_rules: { id: "r", title: "Permit" } })?.href).toBe("/immigration/r");
  expect(describeItem({})).toBeNull();
});
it("parses optional years strictly", () => {
  expect(parseYear("")).toBeNull();
  expect(parseYear("2028")).toBe(2028);
  for (const bad of ["1999", "2101", "20.5", "soon"]) expect(parseYear(bad)).toBe("invalid");
});
it("accepts a budget only when amount, currency and period are all valid", () => {
  expect(parseBudget("", "", "")).toEqual({ amount: null, currency: null, period: null });
  expect(parseBudget("12,000.50", "eur", "per_year")).toEqual({ amount: 12000.5, currency: "EUR", period: "per_year" });
  for (const [a, c, p] of [["1000", "", ""], ["-1", "EUR", "total"], ["1000", "EURO", "total"], ["1000", "EUR", "weekly"], ["abc", "EUR", "total"]]) {
    expect(parseBudget(a, c, p)).toBe("invalid");
  }
});
it("maps database codes to safe messages", () => {
  expect(workspaceError("23505")).toContain("đã có");
  expect(workspaceError("postgres://secret")).not.toContain("secret");
});

it("words workspace labels and errors in English and accepts either language's delete word", async () => {
  const { itemKindLabel, targetDegreeLabel, applicationStatusOptions, deleteConfirmation, isDeleteConfirmation } = await import("./domain");
  expect(itemKindLabel("immigration_rule", "en")).toBe("Immigration rule");
  expect(itemKindLabel("immigration_rule")).toBe("Quy định nhập cư");
  expect(targetDegreeLabel("master", "en")).toBe("Master's");
  expect(applicationStatusOptions("en")).toContainEqual(["awaiting_decision", "Awaiting a decision"]);
  expect(workspaceError("23505", "en")).toBe("This item is already in your saved list.");
  // Unknown codes, including Object.prototype names, never leak or crash.
  for (const code of ["constructor", "toString", "postgres://secret"]) expect(workspaceError(code, "en")).toBe("Could not save. Check the data and try again.");
  expect(deleteConfirmation("en")).toBe("DELETE");
  expect(isDeleteConfirmation("XÓA") && isDeleteConfirmation("DELETE")).toBe(true);
  expect(isDeleteConfirmation("delete") || isDeleteConfirmation("")).toBe(false);
});
