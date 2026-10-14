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

it("explains known rejection reasons in Vietnamese and keeps unknown ones as recorded", async () => {
  const { reasonLabel } = await import("./domain");
  expect(reasonLabel("Excerpt not found verbatim in the document text")).toContain("không có nguyên văn");
  expect(reasonLabel("Number 10656 not found in the excerpt")).toContain("10656");
  expect(reasonLabel("Fact type does not fit this page")).toContain("không hợp với trang");
  expect(reasonLabel("Structured value does not fit the fact type", "en")).toBe("Structured value does not fit the fact type");
  expect(reasonLabel("Something new")).toBe("Something new");
  expect(reasonLabel(null)).toBeNull();
});

it("explains what the database dropped from an AI candidate, keeping unknown notes as recorded", async () => {
  const { adjustmentLabel } = await import("./domain");
  expect(adjustmentLabel("Structured value dropped: 24 is not in the excerpt")).toBe("Bỏ con số 24: câu trích không có số này (AI tự tính hoặc đổi đơn vị).");
  expect(adjustmentLabel('Fact type dropped: "tuition_fee" does not fit this page')).toContain("“tuition_fee”");
  expect(adjustmentLabel("Structured value dropped: 24 is not in the excerpt", "en")).toBe("Structured value dropped: 24 is not in the excerpt");
  expect(adjustmentLabel("Something new")).toBe("Something new");
});
