# Slice 3 — Documents, ingestion and processing status

## What was built and why

`/documents` lists the latest 100 recorded document versions. `/documents/[id]`
shows source attribution, original URL, supplied dates, short excerpt, metadata and
extraction status, and up to 20 related versions. Unknown values stay unknown. No
fixture is seeded into the real database. The empty screen is intentional until an
operator imports a real document they may use.

An internal POST API accepts metadata from an operator tool holding a bearer token.
Documents are append-only so a changed page cannot silently overwrite earlier
material that may later support evidence. PostgreSQL enforces foreign keys, unique
version identity, length/hash/date checks and role access. See
`docs/architecture/slice-03.md` for the ERD and detailed boundaries.

## Flow

1. Operator supplies a metadata JSON file and an already-obtained source file.
2. The helper computes SHA-256 of the original bytes locally; it uploads no full text.
3. POST `/api/ingestion/documents` validates the secret, content type, byte budget,
   schema and dates. Unknown fields are rejected rather than silently accepted.
4. A restricted Prisma transaction checks source registration/origin and crawl policy.
5. INSERT ON CONFLICT prevents duplicate rows even for concurrent retries.
6. Matching metadata returns unchanged; conflicting metadata returns 409. Changed
   content creates a new version. No historical fields are updated.
7. Public pages read through anon RLS. React renders excerpts as escaped text.

## Important files and recommended reading order

1. `lib/documents/domain.ts`: request contract, null handling, validation, source rules.
2. `lib/documents/security.ts`: token comparison and streamed body size limit.
3. `lib/documents/ingest.ts`: metadata hash and append-only transaction/deduplication.
4. `app/api/ingestion/documents/route.ts`: HTTP status and sanitized operation logs.
5. `prisma/schema.prisma` and `prisma/migrations/20260918090000_documents/migration.sql`.
6. `lib/documents/queries.ts` and `app/(public)/(explore)/documents/`: public UI.
7. `scripts/ingest-document.mjs`: operator command; no crawler or external source fetch.
8. Domain, route, ingestion and SQL tests alongside the implementation.

## Next.js and TypeScript concepts

Route Handlers use standard Request/Response objects. This endpoint uses the Node
runtime because hashing and Prisma run server-side. Secret-dependent modules import
`server-only` so the browser cannot bundle them. GET pages stay Server Components;
`connection()` defers list queries until a request, and dynamic params are awaited.
Existing explore loading/error boundaries handle slow/failed reads. Unknown UUIDs
return 404 instead of causing SQL UUID cast errors.

Input JSON starts as `unknown`: validation creates a typed DocumentInput rather than
casting arbitrary client data into Prisma. IngestionError carries a controlled HTTP
status/code; unexpected errors receive a generic 503. Nullable dates distinguish
missing knowledge from real dates. Descriptive state types do not grant permissions;
SQL grants and RLS provide the enforcement boundary.

## API contract

POST `/api/ingestion/documents`, `Content-Type: application/json`,
`Authorization: Bearer <INGESTION_API_TOKEN>`. Do not put the token in a query string,
client component, NEXT_PUBLIC variable or committed file.

Required fields:

- `sourceId`: UUID of an existing source in Source Registry.
- `url`: actual document HTTP(S) URL on that source's exact origin (max 2048 chars).
- `contentHash`: lowercase SHA-256 hex of original uncompressed response/file bytes.
- `retrievedAt`: actual retrieval timestamp in UTC ISO format ending in Z.
- `ingestionMethod`: `manual` or `crawler`.

Optional fields: `title` (300 chars), `documentType` (webpage/pdf/text/unknown),
`excerpt` (500 chars), `publishedAt`, `sourceUpdatedAt`. Missing values remain null
except documentType = unknown. Supply only public material you may store. The
character cap does not itself establish permission to quote copyrighted material.
Dates must not be in the future; publication/update cannot follow retrieval. Use
null when those source dates are not established. Raw file/reference storage and
verification timestamps are intentionally absent because they are not implemented.

Responses:

| Status | Meaning |
|---|---|
| 201 | New immutable version; metadata stored, extraction not started |
| 200 | Existing version with matching metadata; unchanged |
| 400 | Invalid payload/field/date/hash/JSON |
| 401 | Missing or incorrect internal token; login cookies do not grant access |
| 409 | Same URL/content hash but conflicting metadata; review required |
| 413 / 415 | Request exceeds byte limit / unsupported media type |
| 422 | Unregistered, blocked or mismatched source; crawler not enabled |
| 503 | Token configuration or database/service unavailable |

Error responses/logs include a request ID. No arbitrary upstream error is exposed.

## Local setup and import

The local server token was generated in `.env.local` without printing it. For other
environments generate a random secret of at least 32 characters and configure the
same value in the server and trusted operator environment. `.env.example` has a blank
INGESTION_API_TOKEN entry. Keep the existing Supabase and database configuration.

Apply schema with `npx prisma migrate deploy`, regenerate with `npx prisma generate`,
then restart `npm run dev`. Prisma loads `.env.local`. Use development first.

Prepare `metadata.json` containing the actual required/optional metadata above,
except contentHash: the helper adds it from the local source file. Obtain sourceId
from the sources table; do not invent IDs or create fake sources. Then run:

```sh
node scripts/ingest-document.mjs metadata.json source-content-file
```

The helper uses NEXT_PUBLIC_APP_URL as destination. It refuses cleartext HTTP except
localhost and refuses redirects to avoid forwarding the token elsewhere. Local input
limits: 16 KiB metadata / 10 MiB source file. It never fetches URLs or uploads the
original content. Do not use synthetic test fixtures against the hosted database.

## Security and common mistakes

- A normal authenticated account is not an ingestion operator.
- Never use the service-role key as the ingestion token or expose either to browsers.
- Keep database role membership narrow; do not remove RLS to fix connection problems.
- Do not hash a summary/excerpt in place of original source bytes. The API cannot
  independently verify a submitted content hash; it is not evidence of truth.
- Same bytes from different URLs/sources retain separate provenance records.
- A retry does not refresh verification or replace the first retrieval date.
- Do not mark seeds crawl-enabled to make a test pass. Manual imports do not crawl.
- A stored document is not a verified fact, and source tier does not change that.
- Processing failures before insertion appear in logs, not as fabricated document rows.
- Future extraction/status transitions require a new migration and worker/API design;
  Slice 3 deliberately cannot claim that AI/extraction has already run.

## Tests and dependencies

No new dependency is required. PGlite from the existing locked Prisma dependency
tree runs SQL tests in memory, as in Slice 2. It never becomes a runtime datastore.
SQL tests change session identity (not only current role) when checking that public
users cannot SET ROLE to the ingestor: a superuser session could otherwise assume
any role and make the test misleading.

Run `npx prisma validate`, `npx next typegen`, `npx tsc --noEmit`, `npx vitest run`,
`npm run lint` and `npm run build`. Tests cover authorization before work, schema
rejection, hashes/conflicts, source/crawler boundaries, retry idempotency, version
history, FK/CHECK constraints, public reads and denied writes, and safe logging.

Manual UI checks: empty library, known/unknown IDs, links and attribution, excerpt
escaping, narrow-screen layout, error retry, and missing dates. For a real authorized
import, confirm first request 201, exact retry 200, conflicting metadata 409, changed
content 201 with both versions retained. Do not use made-up data for this check.

## Verified in this workspace

- Migration applied successfully to the previously confirmed development Supabase.
- 66 local tests passed; hosted database tests remain opt-in during normal test runs.
- Prisma validation, TypeScript, ESLint and production `next build --webpack` passed.
  The first sandbox build could not resolve Google Fonts; the permitted network retry
  completed successfully without changing fonts or product behavior.
- `DOCUMENTS_LIVE_TEST=1 npx vitest run lib/documents/live.test.ts` passed using real
  Prisma queries: no documents, public users cannot insert or assume the ingestor
  role, internal role can insert but not update and can read sources/documents.
- `node scripts/smoke-documents.mjs` passed against a temporary production server:
  empty library HTTP 200, not-found UI for invalid ID, POST without token HTTP 401,
  and authorized invalid payload HTTP 400. It shuts down the temporary server.
- Next.js can stream loading UI before notFound(), resulting in HTTP 200 with a
  not-found page; non-streamed not-found responses use 404. The smoke test checks
  the actual not-found UI rather than incorrectly requiring 404 in all cases.
- No hosted synthetic documents or real source imports were created. Successful
  inserts, deduplication, conflicts and changed versions were exercised in isolated
  SQL/service tests; an end-to-end real import awaits actual authorized material.
- No interactive browser/responsive inspection was performed; static rendering and
  production HTTP checks passed.

The ingestion route skips browser-session refresh in `proxy.ts` because its bearer
credential is its authentication boundary. This avoids coupling internal ingestion
to Supabase Auth availability; the route itself still fails closed without a token.
