# extractor

Slice 10a AI extraction worker. See `docs/architecture/slice-10a-ai-extraction.md`
and `docs/learning/slice-10a-ai-extraction.md`.

## What it does

1. Claims up to 5 (max 10) documents an editor requested on the document page
   (`extraction_requests`). Only crawler text (`document_texts`) is sent — public
   page content, never user data.
2. Sends each text (cut at 50 000 characters on a line break) to an
   OpenAI-compatible Chat Completions endpoint with a fixed JSON schema.
3. Hands every candidate to `extractor_propose()`, which checks it in the
   database: excerpt verbatim in the page, every number of the value (and date
   years) in the excerpt, topic from a fixed list, known country, valid dates,
   not a duplicate, at most 30 per document. Passing candidates become facts with
   status `proposed`, `origin = 'ai'`, created by the configured AI account.
4. Logs every candidate with its outcome and reason (`/admin/extraction`).

Nothing is reviewed, flagged as a conflict or published automatically.

## Commands

```bash
npm run extract -w @nordic/extractor                        # process pending requests (needs all env vars)
npm run dry-run -w @nordic/extractor -- page.txt [url]      # model on a local text file, no database
npm run test -w @nordic/extractor
npm run typecheck -w @nordic/extractor
```

Environment: `EXTRACTOR_DATABASE_URL`, `LLM_BASE_URL`, `LLM_MODEL`,
`LLM_API_KEY`, optional `EXTRACTOR_MAX_DOCUMENTS` and `EXTRACTOR_TRIGGER`.
Scheduled runs: `.github/workflows/extractor.yml`.

Tip for `dry-run`: save the output of the crawler probe
(`npm run probe -w @nordic/crawler -- <url> main`) or copy the text from the
"Văn bản trích (nội bộ)" section of a document into a file.

## TLS (added 2026-09-28)

Set `DATABASE_CA_CERT` (GitHub secret) to Supabase's root CA PEM so the database
connection is verified. Without it, `sslmode=require` fails with
"self-signed certificate in certificate chain" and a URL without `sslmode` is
not verified. Details: `docs/architecture/slice-10a-ai-extraction.md`.
