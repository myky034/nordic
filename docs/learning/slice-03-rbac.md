# Slice 3 extension — Roles, permissions and browser intake

## What was built

- `/admin/access`: create/edit roles, select permissions, search/paginate Auth users,
  grant/revoke roles and review the last 50 access audit entries.
- `/documents/import`: source picker, metadata/date fields, local file hashing,
  preview, import, created/unchanged/conflict feedback and link to the stored document.
- Dashboard buttons appear according to the current user's database permissions.
- Five relational tables, guarded mutation RPCs, RLS, audit and one-shot bootstrap.

Role names and membership are configurable. New accounts receive no privileged role.
Public reading remains available to visitors and regular users. The migration does
not pick an admin account. No new dependency or authentication provider was added.

## First-time setup

1. Apply `npx prisma migrate deploy` and `npx prisma generate` against development.
2. In Supabase Authentication → Users, select a confirmed user you want to administer
   the app and copy their UUID. Do not send passwords or keys to anyone.
3. Run once from the project directory:

```sh
node scripts/bootstrap-admin.mjs <user-UUID>
```

4. Sign in as that user, open `/dashboard` then **Người dùng & phân quyền**.
5. Create a role and tick its permissions, or use the Editor preset.
6. Search another user's email and assign the role. The user sees **Nhập tài liệu**
   on the next dashboard request if documents.ingest was granted.
7. Prefer assigning a second trusted administrator before changing admin roles.

This operation writes an ordinary database membership; no identity is embedded in
code. Later assignments use the UI. Bootstrap cannot be rerun to take over an
existing system. A missing bootstrap is different from a runtime error or missing
API token. Normal users cannot bootstrap themselves through the website.

## Browser import walkthrough

Choose **Nhập tài liệu**, select a registered source, enter the original document URL
and known metadata, select the source file obtained legitimately, then **Xem trước**.
Review the public metadata/excerpt and **Xác nhận nhập**. Read the resulting status
and follow **Xem tài liệu**. An exact retry returns unchanged; conflicting metadata
is rejected, not silently overwritten. All prior Slice 3 validations still apply.

The browser file limit is 10 MiB. File bytes stay on the device; only a SHA-256 hash
and metadata are sent. Hashing needs JavaScript and a secure browser context (HTTPS
or localhost). Local datetime inputs are converted to UTC before submission. Unknown
source dates stay null. No automatic source fetch, crawling or verification occurs.

## Important files / reading order

1. `docs/architecture/rbac.md`: ERD, authorization and invariants.
2. `prisma/migrations/20260918100000_rbac/migration.sql`: catalogue seeds, FK, RLS,
   guarded functions, lock, delegation rules, admin safeguard and atomic audit.
3. `lib/rbac/access.ts`: verified identity, uncached permission lookup, safe types.
4. `app/(app)/admin/access/actions.ts`: authenticated form actions calling guarded RPCs.
5. `app/(app)/admin/access/page.tsx` and `forms.tsx`: catalogue and user management UI.
6. `app/(app)/documents/import/`: permission-guarded intake and preview.
7. `lib/documents/ingest.ts`: atomic browser permission recheck before append-only write.
8. `scripts/bootstrap-admin.mjs`: explicit, one-shot initial assignment.
9. `lib/rbac/*.test.ts` and document ingestion tests.

## Next.js / TypeScript concepts

Server Components read role data through the logged-in Supabase client; Client
Components use useActionState for pending/result messages. Server Actions are callable
endpoints, so every action repeats permission checks, regardless of visible buttons.
The SQL RPC repeats authorization too, protecting direct Data API calls. revalidatePath
refreshes relevant screens; authorization never depends on that cache refresh.

PermissionKey is a TypeScript union of supported capabilities, not an account allowlist.
ActionState only contains safe feedback and optional document ID. User-supplied actor
IDs are ignored. Type-only imports do not pull server credentials into browser code.
No service-role credential is needed for the UI.

The preview form dispatches its action in a React transition rather than a native
form action to retain draft inputs after validation errors. FormData is captured
before fields are disabled during async file hashing. Result messages are hidden
when returning to edit, so a prior successful import does not describe a new draft.

## Security and common mistakes

- Hiding a button is UX, not authorization; both server and database check rights.
- Never trust role names from editable Auth user_metadata or submitted form fields.
- Never cache permissions in JWTs if revocation must apply on the next request.
- A role-management operator cannot grant privileges they do not hold.
- Normal users cannot insert user_roles, call bootstrap, modify audit or read auth.users.
- Search RPC returns only ID/email/role IDs; never Auth credential columns.
- Final-admin checks and audit share the mutation transaction and advisory lock.
- Auth user deletion with memberships is restricted; do not bypass this with owner SQL.
- A source file is not uploaded; the operator remains responsible for source integrity.
- Prisma does not own auth.users. The FK is in migration SQL; avoid db push/schema
  rewrites that remove SQL-only RLS, functions or external-schema references.
- Empty role names, duplicate names and out-of-scope permission assignments are errors.

## Tests

Run `npx prisma validate`, `npx next typegen`, `npx tsc --noEmit`, `npx vitest run`,
`npm run lint`, and `npm run build -- --webpack`.

Database tests use synthetic Auth users only in disposable PGlite, not Supabase.
They verify no auto-promotion, owner-only one-shot bootstrap, RLS, delegation denial,
self-assignment denial, last-admin rollback, deletion FK, immediate revocation,
auditing and handover. Action tests verify checks happen before RPC/ingestion, actor
spoofing is ignored and raw errors are not shown. Document tests verify in-transaction
permission recheck and preserve the original internal-token path.

Manual checks after choosing a first administrator: sign in as ordinary user and as
manager; create a role; assign to another user; check their dashboard/import action;
revoke it while the user's old page remains open and confirm submission is denied;
try removing final management permissions; review audit. Do not use fictitious source
documents on the hosted database. Browser/device layout testing remains separate from
static render and SQL tests.

### Verification recorded on 2026-09-18

- RBAC migration deployed successfully to the development/test database.
- Full local suite: 81 passed; 3 opt-in live tests skipped in the default run.
- Separate `RBAC_LIVE_TEST=1 npx vitest run lib/rbac/live.test.ts`: passed against
  the development database, checking catalogue, denied bootstrap/direct writes,
  and RLS without creating users or assigning memberships.
- TypeScript, ESLint, Prisma validation and production webpack build passed.
- First-admin assignment and authenticated browser walkthrough still require an
  operator-selected confirmed Auth user UUID; no account was automatically promoted.
