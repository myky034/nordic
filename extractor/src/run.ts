import { LIMITS, PROMPT_VERSION } from "./config";
import type { ExtractorDb } from "./db";
import { LlmError, type Llm } from "./llm";
import { buildMessages, candidateSchema, truncateText } from "./prompt";
import { parseCandidates } from "./validate";

export type RunOptions = {
  db: ExtractorDb; llm: Llm; trigger: "schedule" | "manual" | "local"; maxDocuments?: number;
  delayMs?: number; log?: (line: string) => void;
};

/**
 * One extraction run: claim pending requests, ask the model once per
 * document, and hand every candidate to extractor_propose(), which validates
 * and records it. A failing document never stops the others; the run ends
 * "partial" if any failed. Logs never contain page text, prompts or keys.
 */
export async function runExtraction(opts: RunOptions) {
  const log = opts.log ?? ((line) => console.log(line));
  const limit = Math.min(Math.max(opts.maxDocuments ?? LIMITS.defaultDocuments, 1), LIMITS.maxDocuments);
  const runId = await opts.db.startRun(opts.trigger, opts.llm.provider, opts.llm.model, PROMPT_VERSION);
  let failed = 0;
  try {
    const claimed = await opts.db.claim(runId, limit);
    const countries = claimed.length ? await opts.db.countries() : [];
    for (const [i, doc] of claimed.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, opts.delayMs ?? LIMITS.delayBetweenDocumentsMs));
      const { text, truncated } = truncateText(doc.text);
      try {
        const completion = await opts.llm.complete(buildMessages({ ...doc, text }, countries), candidateSchema);
        const { candidates, dropped } = parseCandidates(completion.content);
        const tally: Record<string, number> = {};
        for (const c of candidates) {
          const r = await opts.db.propose(runId, doc.request_id, c);
          tally[r.outcome] = (tally[r.outcome] ?? 0) + 1;
        }
        const note = [`${candidates.length} candidates`, ...Object.entries(tally).map(([k, n]) => `${k} ${n}`),
          dropped ? `${dropped} over the limit ignored` : "", truncated ? `text cut at ${LIMITS.maxChars} characters` : ""].filter(Boolean).join(", ");
        await opts.db.finishRequest(runId, doc.request_id, "done", note, completion.inputTokens, completion.outputTokens, truncated);
        log(JSON.stringify({ source: "extractor", operation: "document", request: doc.request_id, outcome: "done", tally, truncated,
          tokens: { input: completion.inputTokens, output: completion.outputTokens } }));
      } catch (error) {
        failed += 1;
        const category = error instanceof LlmError ? error.category : "worker_error";
        const message = error instanceof Error ? error.message : "unknown";
        await opts.db.finishRequest(runId, doc.request_id, "failed", `${category}: ${message}`.slice(0, 1000), 0, 0, truncated);
        log(JSON.stringify({ source: "extractor", operation: "document", request: doc.request_id, outcome: "failed", category, message }));
      }
    }
    const counts = await opts.db.finishRun(runId, failed ? "partial" : "succeeded", claimed.length ? null : "No pending requests");
    log(JSON.stringify({ source: "extractor", operation: "finish", runId, documents: claimed.length, failed, counts }));
    return { runId, documents: claimed.length, failed, counts };
  } catch (error) {
    await opts.db.finishRun(runId, "failed", error instanceof Error ? error.message.slice(0, 500) : "unknown").catch(() => undefined);
    throw error;
  }
}
