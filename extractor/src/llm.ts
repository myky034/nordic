import { LIMITS } from "./config";
import type { ChatMessage } from "./prompt";

export type Completion = { content: unknown; inputTokens: number; outputTokens: number; mode?: ResponseMode };
export type Llm = { provider: string; model: string; complete(messages: ChatMessage[], schema: object): Promise<Completion> };
export type Fetcher = typeof fetch;

export class LlmError extends Error {
  constructor(public category: string, message: string) { super(message); }
}

/**
 * How structured output is requested, strictest first. "OpenAI-compatible"
 * providers differ: Gemini's compatibility layer can answer 400
 * INVALID_ARGUMENT to JSON-schema keywords it does not support. On a 400 the
 * client falls back to the next mode and remembers the one that worked.
 * Correctness never depends on the mode: extractor_propose() re-validates
 * every candidate in the database.
 */
export const RESPONSE_MODES = ["json_schema_strict", "json_schema_basic", "json_object"] as const;
export type ResponseMode = typeof RESPONSE_MODES[number];

/** Removes keywords some providers reject (additionalProperties, maxItems). */
export function basicSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(basicSchema);
  if (!schema || typeof schema !== "object") return schema;
  return Object.fromEntries(Object.entries(schema).filter(([k]) => k !== "additionalProperties" && k !== "maxItems").map(([k, v]) => [k, basicSchema(v)]));
}

function responseFormat(mode: ResponseMode, schema: object) {
  if (mode === "json_schema_strict") return { type: "json_schema", json_schema: { name: "fact_candidates", strict: true, schema } };
  if (mode === "json_schema_basic") return { type: "json_schema", json_schema: { name: "fact_candidates", schema: basicSchema(schema) } };
  return { type: "json_object" };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Minimal client for any OpenAI-compatible Chat Completions endpoint
 * (Gemini's /v1beta/openai/, OpenAI, …). No SDK: one POST, bounded retries on
 * 429/5xx honouring Retry-After, a timeout, a response-format fallback on 400,
 * and errors that never include the API key or the prompt.
 */
export function openAiCompatible(opts: { baseUrl: string; apiKey: string; model: string; fetcher?: Fetcher; sleepMs?: (ms: number) => Promise<void>; modes?: readonly ResponseMode[] }): Llm {
  const url = new URL("chat/completions", opts.baseUrl.endsWith("/") ? opts.baseUrl : `${opts.baseUrl}/`);
  if (url.protocol !== "https:") throw new LlmError("config", "LLM_BASE_URL must use https");
  const doFetch = opts.fetcher ?? fetch;
  const wait = opts.sleepMs ?? sleep;
  const modes = opts.modes ?? RESPONSE_MODES;
  let first = 0; // index of the mode that last worked, reused for later documents

  async function send(body: string): Promise<Response> {
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
      return res;
    }
  }
  const failure = async (res: Response) => {
    // Provider error text can be long; keep a short, key-free summary.
    const detail = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    return new LlmError(res.status === 429 ? "rate_limited" : `http_${res.status}`, `LLM HTTP ${res.status}: ${detail}`);
  };

  return {
    provider: url.host,
    model: opts.model,
    async complete(messages, schema) {
      let last: LlmError | null = null;
      for (let i = first; i < modes.length; i++) {
        const mode = modes[i];
        const res = await send(JSON.stringify({ model: opts.model, messages, temperature: 0, response_format: responseFormat(mode, schema) }));
        if (res.status === 400 && i < modes.length - 1) { last = await failure(res); continue; }
        if (!res.ok) throw await failure(res);
        first = i;
        const json = await res.json() as { choices?: { message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
        const text = json.choices?.[0]?.message?.content;
        if (typeof text !== "string") throw new LlmError("empty_response", "LLM returned no message content");
        return { content: parseJson(text), inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: json.usage?.completion_tokens ?? 0, mode };
      }
      throw last ?? new LlmError("config", "No response mode configured");
    },
  };
}

/** Some providers wrap JSON in a ``` fence even in JSON mode. */
export function parseJson(text: string): unknown {
  const unfenced = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(unfenced); } catch { throw new LlmError("invalid_json", "LLM output is not valid JSON"); }
}
