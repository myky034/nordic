import { expect, it } from "vitest";
import { programmeSlotKeys, programmeSlots } from "./programme-slots";

const fact = (id: string, key: string | null, deadline_type: string | null = null) => ({ id, fact_types: key ? { key } : null, deadline_type });

it("fills each checklist slot from typed facts, keeps every fact exactly once, and leaves empty slots empty", () => {
  const { slots, others } = programmeSlots([
    fact("a", "tuition_fee"), fact("b", "min_ielts_overall"), fact("c", "tuition_fee"),
    fact("d", null), fact("e", "residence_permit_fee"),
  ]);
  expect(slots.map((s) => s.key)).toEqual([...programmeSlotKeys]);
  expect(slots.find((s) => s.key === "tuition_fee")!.facts.map((f) => f.id)).toEqual(["a", "c"]);
  expect(slots.find((s) => s.key === "programme_duration")!.facts).toEqual([]);
  expect(others.map((f) => f.id)).toEqual(["d", "e"]);
});
it("counts an untyped deadline (rolling, fixed, year-round) as the deadline slot", () => {
  const { slots, others } = programmeSlots([fact("r", null, "rolling")]);
  expect(slots.find((s) => s.key === "application_deadline")!.facts.map((f) => f.id)).toEqual(["r"]);
  expect(others).toEqual([]);
});
