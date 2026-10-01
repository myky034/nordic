import { describe, expect, it } from "vitest";
import { activity, complete, coverage, crawlerState, dayKeys, dayLabel, daysSince, extractionState, perDay, readWindow } from "./overview";

const now = new Date("2026-10-01T12:00:00Z");

it("treats a table as fully counted only when every row was loaded", () => {
  expect(complete([1, 2], 2)).toBe(true);
  expect(complete([1, 2], 3)).toBe(false);
  expect(complete(null, 0)).toBe(false);
  expect(complete([], null)).toBe(false);
});

it("counts whole days and never invents an age", () => {
  expect(daysSince("2026-09-29T13:00:00Z", now)).toBe(1);
  expect(daysSince(null, now)).toBeNull();
});

describe("crawlerState", () => {
  it("flags a crawler that has not run within the weekly schedule, or never ran", () => {
    expect(crawlerState({ status: "succeeded", started_at: "2026-09-28T03:00:00Z" }, [], now).stale).toBe(false);
    expect(crawlerState({ status: "succeeded", started_at: "2026-09-20T03:00:00Z" }, [], now).stale).toBe(true);
    expect(crawlerState(null, [], now).stale).toBe(true);
  });
  it("counts only URLs whose last outcome needs a look", () => {
    const s = crawlerState(null, [{ last_outcome: "created" }, { last_outcome: "error" }, { last_outcome: "error" }, { last_outcome: "too_large" }, { last_outcome: null }], now);
    expect(s).toMatchObject({ trackedUrls: 5, problemUrls: 3, problems: { error: 2, too_large: 1 } });
  });
});

it("sums AI token use and counts failed or partial runs", () => {
  const s = extractionState([
    { status: "partial", started_at: "2026-09-30T00:00:00Z", input_tokens: 100, output_tokens: 10 },
    { status: "succeeded", started_at: "2026-09-29T00:00:00Z", input_tokens: 50, output_tokens: 5 },
  ]);
  expect(s).toMatchObject({ runs: 2, failedRuns: 1, inputTokens: 150, outputTokens: 15, lastRun: { status: "partial" } });
  expect(extractionState([]).lastRun).toBeNull();
});

describe("coverage", () => {
  const countries = [{ id: "se", slug: "sweden", name: "Sweden" }, { id: "dk", slug: "denmark", name: "Denmark" }];
  const none = { sources: [], facts: [], universities: [], programmes: [], rules: [], occupations: [] };
  it("counts per country, only reviewed items for entities, and a total", () => {
    const { rows, total } = coverage(countries, { ...none,
      sources: [{ country_id: "se", status: "verified" }, { country_id: "se", status: "needs_verification" }],
      facts: [{ country_id: "se", status: "reviewed" }, { country_id: "se", status: "proposed" }, { country_id: "dk", status: "conflicted" }, { country_id: "dk", status: "rejected" }],
      universities: [{ country_id: "se", status: "reviewed" }, { country_id: "se", status: "proposed" }],
    });
    expect(rows.map((r) => r.key)).toEqual(["se", "dk"]);
    expect(rows[0]).toMatchObject({ sourcesVerified: 1, sourcesTotal: 2, factsReviewed: 1, factsProposed: 1, universities: 1 });
    expect(rows[1]).toMatchObject({ factsConflicted: 1, factsReviewed: 0 });
    expect(total).toMatchObject({ sourcesTotal: 2, factsReviewed: 1, factsProposed: 1, factsConflicted: 1, universities: 1 });
  });
  it("adds a no-country row only when something has no country", () => {
    expect(coverage(countries, none).rows).toHaveLength(2);
    const { rows } = coverage(countries, { ...none, occupations: [{ country_id: null, status: "reviewed" }] });
    expect(rows.at(-1)).toMatchObject({ key: "none", country: null, occupations: 1 });
  });
});

it("tallies review decisions per area and ignores unknown values", () => {
  const rows = activity({ facts: [{ decision: "reviewed" }, { decision: "revalidated" }, { decision: "odd" }], education: [{ decision: "rejected" }], immigration: [], labour: [] });
  expect(rows[0]).toMatchObject({ kind: "facts", total: 2, counts: { reviewed: 1, revalidated: 1, rejected: 0 } });
  expect(rows[1]).toMatchObject({ kind: "education", total: 1 });
});

it("reads the activity window, defaulting to 7 days", () => {
  expect(readWindow("30")).toBe(30);
  expect(readWindow("90")).toBe(7);
  expect(readWindow(undefined)).toBe(7);
});

describe("per-day series", () => {
  it("lists the window's UTC days oldest first, ending today", () => {
    expect(dayKeys(3, now)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01"]);
    expect(dayLabel("2026-09-05")).toBe("5/9");
  });
  it("sums into days, keeps empty days at zero and drops rows outside the window", () => {
    const rows = [{ at: "2026-09-30T23:59:00Z", d: "reviewed" }, { at: "2026-09-30T01:00:00Z", d: "reviewed" }, { at: "2026-10-01T08:00:00Z", d: "rejected" }, { at: "2026-08-01T00:00:00Z", d: "reviewed" }, { at: "", d: "reviewed" }];
    const out = perDay(rows, (r) => r.at, dayKeys(3, now), (r) => ({ [r.d]: 1 }));
    expect(out).toEqual([{ day: "2026-09-29", values: {} }, { day: "2026-09-30", values: { reviewed: 2 } }, { day: "2026-10-01", values: { rejected: 1 } }]);
  });
  it("records every crawl outcome, not only problems", () => {
    expect(crawlerState(null, [{ last_outcome: "created" }, { last_outcome: "error" }], now).outcomes).toEqual({ created: 1, error: 1 });
  });
});
