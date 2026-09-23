// =============================================================================
// Health Check Endpoint — app/api/health/route.ts  →  GET /api/health
// =============================================================================
//
// WHY this endpoint exists:
//   Provides a simple, dependency-verifiable liveness check.
//   Vercel, uptime monitors, and CI pipelines can call this to confirm:
//     1. The Next.js application is running and responding.
//     2. Required environment variables are present.
//     3. The database connection (via Prisma + pooler) is functional.
//
// WHAT it checks:
//   - env:  NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
//           NEXT_PUBLIC_APP_URL, and DATABASE_URL are non-empty.
//   - db:   Runs `SELECT 1` via Prisma to confirm the pooled connection works.
//
// WHAT it does NOT do:
//   - Does not query any domain table (no countries, sources, etc.).
//   - Does not require authentication or an elevated/service-role key.
//   - Does not expose connection strings, stack traces, or secret values
//     in the response — only category-level error strings.
//
// Response shape:
//   200 { status: "ok",       checks: { env: "ok", db: "ok"    }, timestamp }
//   200 { status: "degraded", checks: { env: "ok", db: "error" }, error: "<category>", timestamp }
//   503 { status: "degraded", checks: { env: "error", ...      }, error: "<category>", timestamp }
// =============================================================================

import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/** Category-level error labels — never include secrets or stack traces. */
type CheckStatus = "ok" | "error";

interface HealthResponse {
  status: "ok" | "degraded";
  checks: {
    env: CheckStatus;
    db: CheckStatus;
  };
  error?: string;
  timestamp: string;
}

export async function GET() {
  const timestamp = new Date().toISOString();

  // --- 1. Environment check ---
  const requiredVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_APP_URL",
    "DATABASE_URL",
  ];

  const missingVar = requiredVars.find((v) => !process.env[v]);

  if (missingVar) {
    const body: HealthResponse = {
      status: "degraded",
      checks: { env: "error", db: "error" },
      // Include only the variable NAME, never its value.
      error: `missing_env_var:${missingVar}`,
      timestamp,
    };
    return NextResponse.json(body, { status: 503 });
  }

  // --- 2. Database connectivity check ---
  try {
    // SELECT 1 — the lightest possible query; confirms the connection pool
    // can reach PostgreSQL without touching any application table.
    await prisma.$queryRaw`SELECT 1`;

    const body: HealthResponse = {
      status: "ok",
      checks: { env: "ok", db: "ok" },
      timestamp,
    };
    return NextResponse.json(body, { status: 200 });
  } catch {
    // Log the error category server-side but return only a category label
    // in the response — never expose the connection string or error message.
    console.error("[health] db_connection_failed");

    const body: HealthResponse = {
      status: "degraded",
      checks: { env: "ok", db: "error" },
      error: "db_connection_failed",
      timestamp,
    };
    return NextResponse.json(body, { status: 200 });
  }
}
