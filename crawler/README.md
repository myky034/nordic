# crawler

Empty placeholder, prepared ahead of Slice 9 (see `PROJECT_SPEC.md` Section 16).

When Slice 9 starts, this package will hold a Node.js/TypeScript
[Crawlee](https://crawlee.dev) worker that:

- reads approved sources from `@nordic/db` (never writes to `sources`),
- writes documents to Supabase using a service-role key, never imported
  by or exposed to `apps/web`,
- runs on a schedule via GitHub Actions, not inside the Next.js app.

Read `PROJECT_SPEC.md` Section 8 (Crawler Rules) and `AGENTS.md` Section 6
(Crawler Hard Boundaries) before adding code here.
