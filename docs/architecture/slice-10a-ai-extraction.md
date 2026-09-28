

## Update 2026-09-28 — response-format fallback (HTTP 400 from Gemini)

The first real run failed with `LLM HTTP 400 … INVALID_ARGUMENT`: the
provider's OpenAI-compatibility layer rejected the structured-output request.
The client now tries, strictest first, `json_schema` with `strict: true`,
then `json_schema` without `strict`/`additionalProperties`/`maxItems`, then
plain `json_object`, moving on only after a 400 and remembering the mode that
worked. The mode is written to the request note (`mode …`) and the run log.
The prompt describes the JSON shape explicitly so plain JSON mode works;
prompt version is now `extract-v2`. Safety does not depend on the mode: every
candidate is still validated by `extractor_propose()`.

Diagnose a provider/model without the database or any page text:

```bash
npm run check-llm -w @nordic/extractor   # needs LLM_BASE_URL, LLM_MODEL, LLM_API_KEY
```
