

### 2026-09-28 — LLM response-format fallback

- Gemini's OpenAI-compatible endpoint answered HTTP 400 INVALID_ARGUMENT to the
  strict JSON-schema request. The extractor now falls back (only on 400) to a
  basic schema and then to plain JSON mode, and records the mode used.
  Candidates are validated in the database regardless of mode. Prompt version
  `extract-v2`.
