import type { NormalizeSpec } from "../types";
import { normalizeCredits } from "./credits";
import { normalizeDate } from "./date";
import { normalizeDuration } from "./duration";
import { normalizeMoney } from "./money";
import { normalizePace } from "./pace";
import { EMPTY_VALUE, type NormalizeResult } from "./result";

export type { NormalizeResult, Reading, Reason, ReasonCode } from "./result";
export { normalizeCredits, normalizeDate, normalizeDuration, normalizeMoney, normalizePace };

/** Runs the normalizer a rule names. Text facts keep only the words: no structured value. */
export function normalize(spec: NormalizeSpec, text: string): NormalizeResult {
  switch (spec.kind) {
    case "duration": return normalizeDuration(text);
    case "credits": return normalizeCredits(text);
    case "money": return normalizeMoney(text, { periods: spec.periods });
    case "date": return normalizeDate(text, { order: spec.order });
    case "pace": return normalizePace(text);
    case "text": return { raw: { text, unit: null }, readings: [{ status: "ok", text, value: EMPTY_VALUE, notes: [] }], failure: null };
  }
}
