// =============================================================================
// Prisma Configuration File — prisma.config.ts
// =============================================================================
//
// This file is read ONLY by the Prisma CLI (prisma migrate dev/deploy,
// prisma db push/pull, prisma generate, prisma studio).
// It is NOT imported or used at application runtime.
//
// Why a separate config file (Prisma 7)?
//   Prisma 7 introduced prisma.config.ts to separate CLI configuration from
//   the schema file. This lets you use TypeScript + dotenv for dynamic config
//   and keeps database URLs out of schema.prisma.
//
// Why DIRECT_URL here instead of DATABASE_URL?
//   The Prisma CLI migration engine uses the PostgreSQL extended query protocol.
//   Supabase's transaction pooler (PgBouncer, port 6543) does NOT support the
//   extended protocol, so migrations hang or fail if pointed at the pooler.
//   DIRECT_URL must point to a non-transaction-pooled connection — either the
//   direct host or the session pooler (port 5432). See .env.example for details.
//
//   At runtime, the application uses DATABASE_URL (pooled) via @prisma/adapter-pg
//   in lib/db.ts — that file is never involved here.
// =============================================================================

import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Match Next.js local configuration without overriding exported CI variables.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

export default defineConfig({
  // Path to the Prisma schema file, relative to this config file.
  schema: "prisma/schema.prisma",

  datasource: {
    // DIRECT_URL: non-transaction-pooled connection for CLI operations only.
    // This value is ignored entirely at application runtime.
    //
    // Why the fallback to ""?
    //   Prisma 7 auto-loads prisma.config.ts on every CLI command, including
    //   `prisma generate`, which does not need a database URL at all.
    //   Using env() without a fallback throws PrismaConfigEnvError when
    //   DIRECT_URL is not set in the environment, blocking `generate`.
    //   The empty-string fallback lets `generate` run safely; migrate/push
    //   will still fail with a clear connection error if DIRECT_URL is unset.
    url: process.env.DIRECT_URL ?? "",
  },
});
