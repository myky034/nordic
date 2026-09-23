# Nordic — Europe Study & Career Intelligence Portal

Read `AGENTS.md` and `PROJECT_SPEC.md` before making changes — they define
the product, architecture and hard data-integrity/security rules this
repository must follow.

## Monorepo layout

```
apps/web/       Next.js app (routes, UI, server actions, API routes).
packages/db/     Prisma schema, migrations, generated client — shared
                 between apps/web and, from Slice 9 onward, crawler/.
crawler/         Empty placeholder reserved for Slice 9.
scripts/         Operational scripts (bootstrap, manual ingestion,
                 registry/document smoke checks). Run from the repo root.
docs/            Architecture and learning notes, one file per slice.
```

This is an npm workspaces project — install once from the repo root:

```bash
npm install
```

## Getting started

```bash
npm run dev             # apps/web on http://localhost:3000
npm test                # vitest, from apps/web
npm run lint             # eslint, from apps/web
npm run build            # next build

npm run db:generate      # regenerate the Prisma client in packages/db
npm run db:migrate:dev    # apply/create a migration against DIRECT_URL
npm run db:studio        # Prisma Studio
```

Copy `.env.example` to `.env.local` at the repo root — `apps/web/.env.local`
and `packages/db/.env.local` are symlinks to it, so Next.js, the Prisma CLI
and the scripts in `scripts/` all read the same values without duplication.

## Learning documentation

Each implemented slice has a matching write-up in `docs/learning/` and, for
non-trivial architecture, `docs/architecture/` — read these before touching
the corresponding code.
