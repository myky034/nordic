# AI-drafted proposal batch — 2026-09-26

A one-off batch of **proposals** drafted by the AI assistant from real, public
pages of already-registered sources, so the UI can be reviewed with real data.
Nothing was published automatically: every row below was created with status
`proposed` and must be reviewed by a person holding `facts.review`
(AGENTS.md 1.3).

## Provenance

- **Created by:** the dedicated account "AI draft"
  (`10eba847-edff-44ba-8cf4-5849fa64de12`, role "AI Draft": `facts.propose`,
  `education.manage`, `immigration.manage`, `labour.manage`; no `facts.review`).
  The writer refused to run if that account could review.
- **Writes** went through the same RPCs as the UI (`propose_university`,
  `propose_immigration_rule`, `propose_occupation`, `propose_fact`), acting as
  that account, so RLS and permission checks applied. A dry run (whole batch
  rolled back) preceded the real run.
- **Documents** (5) were imported with `scripts/ingest-document.mjs`
  (ingestion method `manual`); `content_hash` is SHA-256 of the fetched HTML.
- **Fetching:** registered sources only; robots.txt checked first; one request
  at a time with a few seconds between requests; start from the registered URL
  and follow links found on those pages (no guessed URLs). `migri.fi` and
  `udi.no` answered 403 even for robots.txt and were skipped.
- **Excerpts** were checked automatically to be verbatim (whitespace-normalised)
  in the fetched page text. SCB figure excerpts are the page's own text nodes in
  order (heading, column headers, row cells).

## Contents (Sweden only)

| Kind | Count | Source document |
|---|---|---|
| Universities | 12 | Study in Sweden — Universities in Sweden (official URL = the university link supplied by the source) |
| Immigration rules | 3 | Migrationsverket — study (higher education), work, look for work |
| Rule requirements (facts) | 8 | Same Migrationsverket pages (maintenance requirement 2026/2025, admission, tuition, insurance, salary threshold, 1 June 2026 rules, post-study eligibility) |
| Occupations | 8 | SCB — Occupations with highest average monthly salary 2025 (SSYK codes, classification `national`) |
| Occupation figures (facts) | 8 | Same SCB table; reference period `2025`; unit recorded as "per month (currency not stated in the source table)" |

## Known caveats for reviewers

- The SCB table does not state a currency; the unit says so instead of assuming SEK.
- University descriptions come from data embedded in the Study in Sweden page;
  open the page in a browser to confirm the text is shown for that university.
- Registered sources are still `needs_verification`: immigration rules and
  occupation figures stay hidden publicly until the Migrationsverket / SCB
  sources are verified in the Source Registry, even after review.
- To correct a row, reject it and create a new proposal; rows are not edited.
