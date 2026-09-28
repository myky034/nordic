import { LIMITS } from "./config";
import type { ChatMessage } from "./prompt";

export type Completion = { content: unknown; inputTokens: number; outputTokens: number };
export type Llm = { provider: string; model: string; complete(messages: ChatMessage[], schema: object): Promise<Completion> };
export type Fetcher = typeof fetch;

export class LlmError extends Error {
  constructor(public category: string, message: string) { super(message); }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Minimal client for any OpenAI-compatible Chat Completions endpoint
 * (Gemini's /v1beta/openai/, OpenAI, …). No SDK: one POST, bounded retries on
 * 429/5xx honouring Retry-After, a timeout, and errors that never include the
 * API key or the prompt.
 */
export function openAiCompatible(opts: { baseUrl: string; apiKey: string; model: string; fetcher?: Fetcher; sleepMs?: (ms: number) => Promise<void> }): Llm {
  const url = new URL("chat/completions", opts.baseUrl.endsWith("/") ? opts.baseUrl : `${opts.baseUrl}/`);
  if (url.protocol !== "https:") throw new LlmError("config", "LLM_BASE_URL must use https");
  const doFetch = opts.fetcher ?? fetch;
  const wait = opts.sleepMs ?? sleep;
  return {
    provider: url.host,
    model: opts.model,
    async complete(messages, schema) {
      const body = JSON.stringify({
        model: opts.model, messages, temperature: 0,
        response_format: { type: "json_schema", json_schema: { name: "fact_candidates", strict: true, schema } },
      });
      for (let attempt = 0; ; attempt++) {
        let res: Response;
        try {
          res = await doFetch(url, { method: "POST", body, signal: AbortSignal.timeout(LIMITS.timeoutMs),
            headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` } });
        } catch {
          if (attempt < LIMITS.maxRetries) { await wait(2_000 * 2 ** attempt); continue; }
          throw new LlmError("network", "LLM request failed or timed out");
        }
        if ((res.status === 429 || res.status >= 500) && attempt < LIMITS.maxRetries) {
          const retryAfter = Number(res.headers.get("retry-after"));
          await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 120) * 1000 : 5_000 * 2 ** attempt);
          continue;
        }
        if (!res.ok) {
          // Provider error text can be long; keep a short, key-free summary.
          const detail = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
          throw new LlmError(res.status === 429 ? "rate_limited" : `http_${res.status}`, `LLM HTTP ${res.status}: ${detail}`);
        }
        const json = await res.json() as { choices?: { message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        const text = json.choices?.[0]?.message?.content;
        if (typeof text !== "string") throw new LlmError("empty_response", "LLM returned no message content");
        return { content: parseJson(text), inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: json.usage?.completion_tokens ?? 0 };
      }
    },
  };
}

/** Some providers wrap JSON in a ``` fence even in JSON mode. */
export function parseJson(text: string): unknown {
  const unfenced = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(unfenced); } catch { throw new LlmError("invalid_json", "LLM output is not valid JSON"); }
}
