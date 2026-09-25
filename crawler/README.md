# crawler

Slice 9 crawler (see `docs/architecture/slice-09-crawler.md`,
`docs/learning/slice-09-crawler.md`, `PROJECT_SPEC.md` Section 8 and
`AGENTS.md` Sections 6–8).

## What it does

- Fetches **only** URLs registered in `/admin/crawler` (`crawl_targets`), and
  only for sources that are `verified`, crawl policy `approved` and crawl
  enabled. A sitemap target lists URLs filtered by a path prefix (max 100);
  links inside pages are never followed.
- Respects robots.txt (`NordicResearchBot`), one request at a time, 5 s between
  requests to the same domain, 2 MB / 30 s limits, HTML and XML only, an honest
  User-Agent, no redirects to other domains, conditional requests (ETag /
  Last-Modified).
- Hashes the normalised extracted text (`sha256-text-v1`). Unchanged pages do
  not create documents. A changed page creates a new document version, stores
  its text privately (`document_texts`) and flags published facts whose
  evidence was the previous version ("Nguồn đã đổi" review queue).
- Talks to PostgreSQL through five `crawler_*` SQL functions only, as a login
  role that is a member of `nordic_crawler_ops`. It holds **no** service-role
  key and has no table privileges.

## Commands

```bash
npm run probe -w @nordic/crawler -- <url> [css-selector]  # one URL, no database: preview extracted text + hash
npm run crawl -w @nordic/crawler                           # full run (needs CRAWLER_DATABASE_URL)
npm run test -w @nordic/crawler
npm run typecheck -w @nordic/crawler
```

Environment: `CRAWLER_DATABASE_URL` (required for `crawl`), `CRAWLER_CONTACT_URL`
(optional), `CRAWLER_TRIGGER` (`local` by default; the workflow sets
`schedule` / `manual`). Scheduled runs: `.github/workflows/crawler.yml`.

## Original placeholder note (kept for history)

> Empty placeholder, prepared ahead of Slice 9 (see `PROJECT_SPEC.md` Section 16).
>
> When Slice 9 starts, this package will hold a Node.js/TypeScript
> [Crawlee](https://crawlee.dev) worker that:
>
> - reads approved sources from `@nordic/db` (never writes to `sources`),
> - writes documents to Supabase using a service-role key, never imported
>   by or exposed to `apps/web`,
> - runs on a schedule via GitHub Actions, not inside the Next.js app.
>
> Superseded (Slice 9 decision): the crawler uses the least-privilege
> `nordic_crawler_ops` role instead of a service-role key, and reads its work
> list through `crawler_due_targets()` rather than the `sources` table.
