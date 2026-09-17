# Slice 1 — Email sign in and sign up

## What was built

`/login` supports email/password and Google. `/signup` collects email, password,
and confirmation. Both screens include pending/error states and links between them.
Supabase Auth remains the account and password store; no new dependency, schema,
Prisma model, migration, or RLS change is needed.

## Design and flow

1. The Server Component page renders the shared interactive `AuthForm`.
2. React `useActionState` submits FormData to a Server Action and shows a safe result.
3. `readCredentials` validates untrusted input again on the server. The app requires
   eight characters for new passwords; existing passwords are not subject to that
   new-account rule. Supabase remains responsible for its configured password policy.
4. The existing server Supabase client writes authentication cookies. Passwords are
   never stored in application tables or returned in action state.
5. Sign in redirects to `/dashboard`. Signup redirects only if Supabase returns a
   session. Otherwise it displays neutral confirmation instructions, including the
   possibility of an existing account, without claiming that a new account exists.
6. Email confirmation uses the same PKCE `/auth/callback` exchange as Google. Open
   the link in the browser used to register, because PKCE needs its verifier cookie.
7. The existing proxy refreshes cookies, and `requireAuth` verifies claims before
   private pages render. Authentication does not replace RLS for future user tables.

## Important files / reading order

1. `lib/auth/credentials.ts`: input validation, result type and redacted logging.
2. `app/(auth)/actions.ts`: Supabase calls, safe errors and fixed redirects.
3. `app/(auth)/auth-form.tsx`: labels, password autofill, pending and feedback UI.
4. `app/(auth)/login/page.tsx` and `signup/page.tsx`: route entry points.
5. `lib/supabase/server.ts`, `app/auth/callback/route.ts`: session cookies and PKCE.
6. `lib/auth/session.ts`: server authorization boundary.
7. `app/(auth)/actions.test.ts`: isolated action tests with a mocked Auth provider.

## Next.js and TypeScript concepts

`(auth)` is a route group, so it does not appear in URLs. Pages are Server Components;
only the interactive form needs `use client`. `use server` exports callable Server
Actions, whose arguments still require validation. `useActionState` returns state,
an action and a pending flag; `useFormStatus` handles the Google submit button.
`searchParams` is awaited. Next.js `redirect` throws internally, so successful
redirects must be outside catch blocks. AuthState deliberately excludes credentials.
Literal return types allow TypeScript to narrow validated credentials after an error
check. Layout route groups use explicit ReactNode children rather than page paths
that do not exist in Next's generated layout route types.

A pre-existing Prisma import was corrected to the generated `client/client` entry
point so the repository passes type checking; database behavior is unchanged.

## Configuration and security

Set these in `.env.local` (never commit real values):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

In Supabase Auth, enable the Email provider and account signups. Keep email
confirmation enabled for verified email ownership. Set Site URL to the application
origin and allow the exact `/auth/callback` URL for local and deployed environments.
The standard confirmation email must honor the configured redirect (`ConfirmationURL`);
custom templates that send token_hash require a different handler and are not used
here. Configure SMTP for delivery to your intended users and review provider rate
limits. The application respects Supabase rate-limit errors; it does not bypass them.

Only publishable credentials are used; no service-role key is needed. Callback URLs
come from configured app origin, not submitted URLs/Host headers. Logs contain
operation, source, timestamp, numeric status and category, never raw provider errors,
passwords, tokens or emails. Generic login/registration errors reduce account
existence disclosure. Supabase controls duplicate-account and identity-linking behavior;
this feature does not set/reset the password on an existing Google-only account.

## Common mistakes

- Disabling email confirmation just to make the UI redirect immediately.
- Treating a signup user object as an authenticated session.
- Trimming a password or exposing provider errors in logs/UI.
- Catching Next.js redirect exceptions as authentication errors.
- Assuming an existing Google account already has a password.
- Expecting email delivery without valid SMTP/provider configuration.
- Omitting `NEXT_PUBLIC_APP_URL`: signup cannot create its confirmation URL.
  Missing, malformed or non-HTTP(S) origins are rejected before calling Supabase,
  with a configuration-specific message and a redacted `sign_up_configuration` log.
  Restart the dev server after updating `.env.local`; for a different local port,
  update both this variable and the allowed Supabase callback URL.

## Verification

Automated checks: `npx next typegen`, `npx tsc --noEmit`, `npx vitest run`,
`npm run lint`, `npm run build`. Tests mock Supabase; they do not create real users
or prove email delivery or deployed RLS behavior.

Manual checks using a test Supabase project:

- Open `/dashboard` signed out: redirected to `/login`.
- Check both screens on mobile, keyboard tab order, labels and pending states.
- Submit mismatched/short passwords: signup rejected before provider calls.
- Register a fresh email; confirm from the same browser; arrive at dashboard.
- Sign out, then sign in using email/password; refresh dashboard to verify cookies.
- Try wrong password/unconfirmed email, duplicate signup and provider rate limits.
- Cancel Google login and follow the create-account link from its error state.
- Test an expired/reused confirmation URL and temporary network failures.

Real account creation/email delivery remains a manual integration check; no test
emails are sent automatically. Password reset and adding a password to an existing
Google-only account are outside this change.

Reference: https://supabase.com/docs/guides/auth/passwords

## Results in this workspace

- Next route type generation, TypeScript and ESLint passed.
- All 14 action tests passed, including missing/invalid app-origin regression cases.
- Production build could not be verified: sandbox Google Fonts DNS/network access
  failed, and the Turbopack retry encountered a port-binding permission error.
  Webpack also required external font access; permission for that retry was declined.
- Browser interaction and live Supabase email/session integration were not exercised.

## Signup diagnostics

The generic signup message means the Auth client returned an error; it does not
identify a callback failure. Logs now include an allowlisted provider `code` as
well as status. Unknown codes and raw error messages are not logged to avoid PII.
Two regression tests cover code logging and redaction (16 tests total).

A read-only `/auth/v1/settings` request in this workspace returned HTTP 401 with
`Invalid API key`. Check that `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` come from the same Supabase project. Use
its publishable key (or supported legacy anon key), never a service-role/secret
key. Restart Next.js after replacing local environment values. This diagnostic
request does not create an account or send a confirmation email.
