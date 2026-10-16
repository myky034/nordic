import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { decisionLabel } from "./history";

// Every decision the database accepts must have a readable label in both languages, so a new
// decision code (like L7b-0's "withdrawn") is never shown raw. The list comes from the latest
// fact_reviews_decision_check in the migrations.
const migration = readFileSync("../../packages/db/prisma/migrations/20261016100000_withdraw_fact/migration.sql", "utf8");
const decisions = [...migration.match(/CHECK \(decision IN \(([^)]*)\)\)/)![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

it("labels every fact_reviews decision in Vietnamese and English", () => {
  expect(decisions).toEqual(["reviewed", "rejected", "conflicted", "revalidated", "superseded", "withdrawn"]);
  for (const d of decisions) {
    expect(decisionLabel(d, "vi").label, d).not.toBe(d);
    expect(decisionLabel(d, "en").label, d).not.toBe(d);
  }
  expect(decisionLabel("withdrawn", "vi")).toEqual({ label: "Đã rút lại", tone: "neutral" });
  expect(decisionLabel("withdrawn", "en")).toEqual({ label: "Withdrawn", tone: "neutral" });
});

it("falls back to the raw code for an unknown decision", () => {
  expect(decisionLabel("unknown_code")).toEqual({ label: "unknown_code", tone: "neutral" });
});
