import { expect, it } from "vitest";
import { nextDir, readSort, sortRows } from "./table";

it("reads only known sort keys from the URL", () => {
  expect(readSort(["name", "count"] as const, "count", "desc", "name")).toEqual({ key: "count", dir: "desc" });
  expect(readSort(["name", "count"] as const, "evil", undefined, "name", "desc")).toEqual({ key: "name", dir: "desc" });
});
it("flips the direction only when the same column is clicked again", () => {
  expect(nextDir({ key: "name", dir: "asc" }, "name")).toBe("desc");
  expect(nextDir({ key: "name", dir: "desc" }, "name")).toBe("asc");
  expect(nextDir({ key: "name", dir: "asc" }, "count")).toBe("asc");
});
it("sorts numbers numerically and Vietnamese text with the locale, keeping empty values last", () => {
  const rows = [{ n: "Đức", c: 10 }, { n: "An", c: 2 }, { n: "", c: null }, { n: "Bình", c: 30 }];
  expect(sortRows(rows, (r) => r.n, "asc").map((r) => r.n)).toEqual(["An", "Bình", "Đức", ""]);
  expect(sortRows(rows, (r) => r.c, "desc").map((r) => r.c)).toEqual([30, 10, 2, null]);
});
