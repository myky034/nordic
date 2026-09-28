import { expect, it } from "vitest";
import { LlmError, openAiCompatible, parseJson } from "./llm";

const ok = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 20 } }), { status: 200 });
const noWait = async () => {};

it("posts an OpenAI-compatible request with a JSON schema and returns parsed content and tokens", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const llm = openAiCompatible({ baseUrl: "https://llm.example.test/v1beta/openai/", apiKey: "secret-key", model: "synthetic-model",
    fetcher: (async (url: URL, init: RequestInit) => { calls.push({ url: String(url), init }); return ok('{"candidates":[]}'); }) as typeof fetch });
  const result = await llm.complete([{ role: "user", content: "x" }], { type: "object" });
  expect(result).toEqual({ content: { candidates: [] }, inputTokens: 100, outputTokens: 20 });
  expect(calls[0].url).toBe("https://llm.example.test/v1beta/openai/chat/completions");
  const body = JSON.parse(String(calls[0].init.body));
  expect(body).toMatchObject({ model: "synthetic-model", temperature: 0, response_format: { type: "json_schema" } });
  expect(llm.provider).toBe("llm.example.test");
});
it("retries rate limits, then gives up with a category and without leaking the key", async () => {
  let n = 0;
  const flaky = openAiCompatible({ baseUrl: "https://llm.example.test/", apiKey: "secret-key", model: "m", sleepMs: noWait,
    fetcher: (async () => (++n < 3 ? new Response("slow down", { status: 429, headers: { "retry-after": "1" } }) : ok("{}"))) as typeof fetch });
  await flaky.complete([], {});
  expect(n).toBe(3);
  const limited = openAiCompatible({ baseUrl: "https://llm.example.test/", apiKey: "secret-key", model: "m", sleepMs: noWait,
    fetcher: (async () => new Response("quota exceeded", { status: 429 })) as typeof fetch });
  const error = await limited.complete([], {}).catch((e) => e);
  expect(error).toBeInstanceOf(LlmError);
  expect(error.category).toBe("rate_limited");
  expect(error.message).not.toContain("secret-key");
});
it("refuses plain http and non-JSON output", async () => {
  expect(() => openAiCompatible({ baseUrl: "http://llm.example.test/", apiKey: "k", model: "m" })).toThrow("https");
  expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  expect(() => parseJson("not json")).toThrow(LlmError);
});
