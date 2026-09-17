// =============================================================================
// Prisma Client (Runtime) — lib/db.ts
// =============================================================================
//
// WHY this file exists:
//   This is the singleton Prisma Client used by all server-side application
//   code at runtime. It uses a driver adapter (@prisma/adapter-pg) to connect
//   through Supabase's connection pooler (PgBouncer / Supavisor).
//
// WHY a driver adapter instead of the built-in Prisma connection?
//   Supabase runs PgBouncer in transaction pooling mode (port 6543). In this
//   mode each statement may use a different underlying connection, which is
//   incompatible with the prepared statements Prisma uses by default.
//   @prisma/adapter-pg uses unnamed statements by default. Do not configure
//   statementNameGenerator when connecting through a transaction pooler.
//
// WHY DATABASE_URL and not DIRECT_URL?
//   DATABASE_URL points to the pooled connection (port 6543 with pgbouncer=true).
//   This is correct for runtime query execution in serverless environments
//   (Vercel functions) because each function invocation creates a new process
//   and would otherwise exhaust PostgreSQL's connection limit without pooling.
//
//   DIRECT_URL is only used by the Prisma CLI (in prisma.config.ts) and is
//   never imported here.
//
// SINGLETON PATTERN:
//   In Next.js dev mode, hot-reloading creates a new module instance on every
//   file change. Without the global singleton pattern, each reload would
//   create a new PrismaClient, exhausting the connection pool quickly.
//   We store the instance on globalThis to survive hot reloads.
// =============================================================================

import "server-only";

import { PrismaClient } from "@/prisma/generated/client/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Extend the global type to include our Prisma singleton in development.
declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  // Bound pool size and connection waits for serverless instances. Session
  // pooling is also supported for local development.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: 3,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({ adapter });
}

// In production, always create a fresh instance (single process, no HMR).
// In development, reuse the globalThis instance across hot reloads.
export const prisma =
  process.env.NODE_ENV === "production"
    ? createPrismaClient()
    : (globalThis.__prisma ??= createPrismaClient());
