import { expect, it } from "vitest";
import { deadlineLabel, degreeLabel, educationError, likePattern, officialUrl, programmeFilters } from "./domain";

it("allowlists programme filters and drops anything else", () => {
  expect(programmeFilters({ country: "sweden", degree: "master", university: "11111111-1111-4111-8111-111111111111", field: " data " }))
    .toEqual({ country: "sweden", degree: "master", university: "11111111-1111-4111-8111-111111111111", field: "data" });
  expect(programmeFilters({ country: "atlantis", degree: "diploma", university: "1 OR 1=1", field: ["a", "b"] }))
    .toEqual({ country: "", degree: "", university: "", field: "" });
  expect(programmeFilters({ field: "x".repeat(500) }).field).toHaveLength(100);
});
it("escapes LIKE wildcards so search text matches literally", () => {
  expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
});
it("labels unknown degree and deadline types without guessing", () => {
  expect(degreeLabel("master")).toBe("Master");
  expect(degreeLabel("diploma")).toBe("Not stated");
  expect(deadlineLabel("rolling")).toBe("Rolling admission");
  expect(deadlineLabel(null)).toBeNull();
  expect(deadlineLabel("soon")).toBeNull();
});
it("accepts only http(s) official URLs without credentials", () => {
  expect(officialUrl("https://uni.example.test/p#x")).toBe("https://uni.example.test/p");
  expect(officialUrl("javascript:alert(1)")).toBeNull();
  expect(officialUrl("https://user:pw@uni.example.test/")).toBeNull();
});
it("maps only known database codes to messages", () => {
  expect(educationError("education_duplicate")).toContain("trùng");
  expect(educationError("password=secret")).not.toContain("secret");
});
