import { expect, it } from "vitest";
import type { Claimed, ExtractorDb, ProposeResult } from "./db";
import { LlmError, type Llm } from "./llm";
import { candidateSchemaFor } from "./prompt";
import { runExtraction } from "./run";

const tuitionType = { key: "tuition_fee", label_en: "Tuition fee", definition_en: "Fee per period for non-EU students.", value_kind: "money" as const,
  applies_to: "programme", unit_hint: null, min_value: null, max_value: null };
function fakeDb(claimed: Claimed[]) {
  const calls: string[] = [];
  const finished: { request: string; status: string; note: string }[] = [];
  const db: ExtractorDb = {
    startRun: async (t, p, m, v) => { calls.push(`start ${t} ${p} ${m} ${v}`); return "run-1"; },
    countries: async () => [{ slug: "sweden", name: "Sweden" }],
    claim: async (_, limit) => { calls.push(`claim ${limit}`); return claimed; },
    factTypes: async (_, request) => { calls.push(`types ${request}`); return [tuitionType]; },
    propose: async (_, __, c): Promise<ProposeResult> => ({ outcome: c.predicate === "bad" ? "invalid" : "proposed", reason: null, fact_id: null }),
    finishRequest: async (_, request, status, note) => { finished.push({ request, status, note }); },
    finishRun: async (_, status, note) => { calls.push(`finish ${status} ${note}`); return {}; },
    close: async () => {},
  };
  return { db, calls, finished };
}
const doc = (id: string, text = "page"): Claimed => ({ request_id: id, document_id: `d-${id}`, title: null, url: "https://a.example.test/", source_name: "S", source_tier: "T1", text });
const candidate = (predicate: string) => ({ topic: "immigration", subject: "s", predicate, value: "v", unit: "", excerpt: "e", country: "", valid_from: "", valid_until: "", reference_period: "", confidence: 0.5 });

it("proposes every candidate, records a per-document summary and caps documents per run", async () => {
  const { db, calls, finished } = fakeDb([doc("r1")]);
  let schemaKeys: unknown;
  const llm: Llm = { provider: "p", model: "m", complete: async (_, schema) => {
    schemaKeys = (schema as ReturnType<typeof candidateSchemaFor>).properties.candidates.items.properties.fact_type.enum;
    return { content: { candidates: [candidate("a"), candidate("bad")] }, inputTokens: 1, outputTokens: 1 };
  } };
  await runExtraction({ db, llm, trigger: "manual", maxDocuments: 99, delayMs: 0, log: () => {} });
  expect(calls[0]).toBe("start manual p m extract-v4");
  expect(calls[1]).toBe("claim 10");
  // The page's allowed fact types reach the schema, so the model cannot invent a key.
  expect(calls[2]).toBe("types r1");
  expect(schemaKeys).toEqual(["", "tuition_fee"]);
  expect(finished).toEqual([{ request: "r1", status: "done", note: "2 candidates, proposed 1, invalid 1" }]);
  expect(calls.at(-1)).toBe("finish succeeded null");
});
it("keeps going after a model failure and ends the run as partial", async () => {
  const { db, calls, finished } = fakeDb([doc("r1"), doc("r2", "x".repeat(60_000))]);
  let n = 0;
  const llm: Llm = { provider: "p", model: "m", complete: async () => {
    if (++n === 1) throw new LlmError("rate_limited", "LLM HTTP 429: quota");
    return { content: { candidates: [] }, inputTokens: 1, outputTokens: 1 };
  } };
  await runExtraction({ db, llm, trigger: "local", delayMs: 0, log: () => {} });
  expect(finished[0]).toMatchObject({ request: "r1", status: "failed", note: "rate_limited: LLM HTTP 429: quota" });
  expect(finished[1]).toMatchObject({ request: "r2", status: "done" });
  expect(finished[1].note).toContain("text cut at 50000 characters");
  expect(calls.at(-1)).toBe("finish partial null");
});
it("closes an empty run without calling the model", async () => {
  const { db, calls } = fakeDb([]);
  const llm: Llm = { provider: "p", model: "m", complete: async () => { throw new Error("should not be called"); } };
  await runExtraction({ db, llm, trigger: "schedule", log: () => {} });
  expect(calls.at(-1)).toBe("finish succeeded No pending requests");
});
