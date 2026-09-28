

## Provider compatibility (added 2026-09-28)

On HTTP 400 the client falls back from strict JSON schema to a basic schema,
then to plain JSON mode. `npm run check-llm -w @nordic/extractor` shows which
modes a provider/model accepts (tiny request, no page text, no database).
