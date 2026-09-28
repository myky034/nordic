import { expect, it } from "vitest";
import { confidenceLabel, extractionError } from "./domain";

it("always labels confidence as the model's own estimate", () => {
  expect(confidenceLabel("0.85")).toBe("mô hình tự đánh giá 85%");
  expect(confidenceLabel(null)).toBeNull();
  expect(confidenceLabel("abc")).toBeNull();
});
it("maps only known error codes", () => {
  expect(extractionError("extraction_no_text")).toContain("crawler");
  expect(extractionError("postgres://secret")).not.toContain("secret");
});
