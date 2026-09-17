import { describe, expect, it } from "vitest";
import { canonicalSourceUrl, registryFilters, tierLabel, verificationLabel, dateLabel } from "./domain";

describe("registry rules", () => {
  it("does not infer authority from missing or invalid tiers", () => {
    expect(tierLabel(null)).toBe("Unclassified");
    expect(tierLabel("official")).toBe("Unclassified");
    expect(tierLabel("T4")).toContain("Experience");
  });
  it("preserves URL semantics and rejects unsafe links", () => {
    expect(canonicalSourceUrl("https://EXAMPLE.com:443/Path/?b=2&a=1#heading")).toBe("https://example.com/Path/?b=2&a=1");
    for (const url of ["javascript:alert(1)", "https://user:password@example.com/", "not a url", "file:///etc/passwd"]) expect(canonicalSourceUrl(url)).toBeNull();
  });
  it("does not equate reviewed metadata with current facts", () => {
    expect(verificationLabel("verified", null)).toBe("Needs verification");
    expect(verificationLabel("verified", new Date("2020-01-01"))).toContain("content validity unknown");
    expect(verificationLabel("review_required", new Date())).toBe("Review required");
    expect(dateLabel(null)).toBe("Not available");
  });
  it("allowlists filter values and rejects arrays", () => {
    expect(registryFilters({ country: "sweden", tier: "T1", status: "verified" })).toEqual({ country: "sweden", tier: "T1", status: "verified" });
    expect(registryFilters({ country: "' OR 1=1", tier: "toString", status: ["verified"] })).toEqual({ country: "", tier: "", status: "" });
  });
});
