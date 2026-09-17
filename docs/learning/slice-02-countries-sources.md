# Slice 2 — Countries and source registry

## What was built

- `/countries`: five scope entries supplied by PROJECT_SPEC.md.
- `/countries/[slug]`: research status, explicit missing-data message and linked sources.
- `/sources`: source links, classification, review/crawl dates and GET filters for
  country, tier and status. Results are bounded to 100 with an explicit limit notice.
- Links from the landing page and authenticated dashboard.
- Two Prisma models, migration, safe initial seeds and SELECT-only RLS policies.

This is a public, read-only registry. No admin editing, crawling or factual country
profiles are included. Sources start unclassified, unverified, unassigned to a
country and disabled for crawling. No profile content, authority or freshness is
invented. See `docs/architecture/slice-02.md` for plan, ERD and security rationale.

## Why this design

PostgreSQL remains the sole runtime source of truth. Pages query the database;
there is no fallback array that pretends the database succeeded. The seed migration
records product scope, not externally researched facts. Nullable metadata expresses
unknown information. A failed database query produces an error screen, while a
successful query with zero results produces an empty state.

Prisma owns schema/type generation. Handwritten SQL extends the generated migration
with database CHECK constraints and RLS, which Prisma's schema cannot fully express.
Seed inserts run once as part of migration history, so repeating migrate deploy does
not overwrite source reviews. Later metadata changes should use explicit migrations
until an authorized registry editor exists.

## Flow and file responsibilities

Browser GET -> Server Component -> validated filters -> Prisma transaction under
anon role -> PostgreSQL RLS -> typed rows -> source/country UI.

Recommended reading order:

1. `prisma/schema.prisma`: Country/Source and optional foreign key.
2. `prisma/migrations/20260917090000_countries_sources/migration.sql`: tables,
   indexes, validation, access grants, policies and grounded seeds.
3. `lib/registry/domain.ts`: URL normalization, filter allowlists, source tiers and
   truthful date/review labels.
4. `lib/registry/queries.ts`: server-only public data access and redacted errors.
5. `app/(public)/(explore)/`: layout, list/detail pages, source list, error/loading.
6. `lib/registry/domain.test.ts` and `database.test.ts`: domain and SQL/RLS tests.

## Next.js and TypeScript concepts

Route groups share layouts without affecting URLs. Dynamic `[slug]` routes await
`params`; the source page awaits `searchParams`. `connection()` keeps country queries
out of static builds. Server Components keep Prisma and credentials off the browser.
The filters use native GET forms, so URLs are shareable and filtering needs no client
state. `loading.tsx` provides Suspense feedback; `error.tsx` is a Client Component
because retry is interactive. An unknown country calls `notFound()`.

Generated Prisma types describe returned records. `Prisma.TransactionClient` limits
the query callback to one transaction. Literal constants and allowlisted query values
prevent arbitrary status/tier inputs from changing query behavior. SQL is parameterized
by Prisma; the only raw command is a fixed role switch with no user interpolation.

## Security and integrity

- Public read access is intentional; only registry metadata is present.
- Both anon and authenticated roles cannot write; logged in does not mean admin.
- Prisma does not automatically apply JWT context: SET LOCAL ROLE anon is essential.
- The role switch is transaction-local, safe across pooled connection reuse.
- Canonical links accept HTTP(S) only, remove fragments and reject embedded credentials.
  Path case, query order and trailing slash are preserved to avoid merging resources.
- URL normalization is NOT SSRF protection or permission to crawl.
- No source tier implies that every claim is verified. A past metadata review does
  not imply current validity. Unknown dates display Not available.
- Never log database connection strings or raw driver errors. Logs record stage,
  source, timestamp and category.

## Dependencies and testing

No new production dependency was introduced. SQL tests use PGlite, an embedded
PostgreSQL already installed transitively by Prisma in this lockfile. It is strictly
a disposable test database, not an application datastore. An explicit dev-dependency
installation was declined, so this test currently relies on Prisma's locked dependency
tree; review this dependency when upgrading Prisma or changing package managers.

Commands:

```sh
npx prisma validate
npx prisma generate
npx next typegen
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

SQL tests execute the actual migration and verify seeds, UNIQUE/FK/CHECK constraints,
SELECT by both roles, denied writes, and RLS denial even if table write grants are
accidentally added. They do not connect to or mutate the user's Supabase project.
Document hashes, evidence, conflict resolution and crawler retries remain tests for
later slices; those features have not been implemented here.

## Configure and run against Supabase

1. Copy blank entries from `.env.example` into `.env.local` without replacing auth keys.
2. Supabase Connect -> Transaction pooler: use that URI for DATABASE_URL.
3. Supabase Connect -> Direct connection or Session pooler: use it for DIRECT_URL.
4. Replace the password placeholder with the database password; URL-encode reserved
   characters in the password. Never paste credentials into chat or commit them.
5. Confirm this is the intended development database before applying migration:
   `npx prisma migrate deploy`, then `npx prisma generate`.
6. Restart `npm run dev`. Visit `/countries`, `/countries/sweden`, `/sources` and
   `/sources?country=unassigned&tier=unknown&status=needs_verification` signed out.
7. Filter to Sweden: no source coverage should be invented. Unknown slugs return 404.
8. Test narrow-screen layout, keyboard navigation, loading and database outage retry.
9. Repeat browse tests signed in and verify the existing auth flow still works.

## Common mistakes

- Using Supabase's HTTPS Project URL as DATABASE_URL.
- Passing the API key where a database password belongs.
- Running migrations on the transaction pooler or on the wrong environment.
- Calling seeds verified merely because they are in the database.
- Bypassing RLS with a table-owner Prisma connection outside the public read helper.
- Adding an admin action without a server-side authorization model.
- Interpreting unassigned Europe-wide seeds as coverage of every country.

## Verification results and local connection note

- Prisma schema validation, type generation, TypeScript and ESLint passed.
- 32 local tests passed: auth, registry domain, SQL constraints/RLS, query boundary
  and static source-list rendering. The opt-in live test is skipped by default.
- Migration was applied to the user-confirmed development/test Supabase project.
- `node scripts/verify-registry.mjs` passed on that project: both anon and
  authenticated read 5 countries/2 sources and all attempted writes were denied.
  Every write probe is wrapped in a savepoint and rolled back.
- `REGISTRY_LIVE_TEST=1 npx vitest run lib/registry/live.test.ts` passed against the
  deployed database through the real Prisma service. It tests list/detail/filter
  queries and does not modify data. Run it only against the seeded development DB.
- Cold Prisma transaction acquisition exceeded its default two-second maxWait.
  The public read helper now uses bounded 10-second acquisition/execution limits.
- The supplied runtime direct host failed DNS resolution in this environment.
  `.env.local` now uses the successfully tested Session pooler URI for both runtime
  and migrations in development. For Vercel, configure the runtime transaction
  pooler separately; no pooler hostname was invented.
- Production build remains unverified: Google Fonts downloads failed with
  ENOTFOUND in the sandbox. Browser interaction/responsive checks are still manual;
  static render tests do not replace browser tests.
