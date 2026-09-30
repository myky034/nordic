import { expect, it } from "vitest";
import { selectItem } from "./selection";

it("shows the requested item with its neighbours", () => {
  expect(selectItem(["a", "b", "c"], "b")).toEqual({ index: 1, id: "b", prevId: "a", nextId: "c" });
});
it("falls back to the first item when the requested one left the list (e.g. just reviewed)", () => {
  expect(selectItem(["b", "c"], "a")).toEqual({ index: 0, id: "b", prevId: null, nextId: "c" });
  expect(selectItem(["b"], undefined)).toEqual({ index: 0, id: "b", prevId: null, nextId: null });
});
it("selects nothing in an empty list", () => {
  expect(selectItem([], "a")).toEqual({ index: -1, id: null, prevId: null, nextId: null });
});
