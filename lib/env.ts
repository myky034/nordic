// =============================================================================
// Environment Variable Validation — lib/env.ts
// =============================================================================
//
// WHY this file exists:
//   Missing environment variables cause cryptic runtime errors deep inside
//   library code. This module validates required variables at startup and
//   throws a clear, named error immediately so the misconfiguration is
//   obvious from the first log line.
//
// WHAT it validates:
//   - Public variables (safe for browser) are validated unconditionally —
//     they are needed on both client and server.
//   - SERVER_ONLY variables (DATABASE_URL) are only validated in server
//     contexts. Next.js strips NEXT_PUBLIC_ vars on the server but
//     DATABASE_URL must never reach the browser anyway.
//
// HOW to use:
//   Import this module at the top of any server-side file that needs these
//   values. The validation runs once when the module is first imported.
//   After that, use the exported typed constants instead of process.env
//   directly — they are guaranteed non-empty strings.
// =============================================================================

/** Thrown when a required environment variable is missing or empty. */
export class EnvError extends Error {
  constructor(name: string) {
    super(
      `Missing required environment variable: ${name}. ` +
        `Check .env.example for the full list and descriptions.`,
    );
    this.name = "EnvError";
  }
}

/** Reads an environment variable and throws EnvError if it is missing. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new EnvError(name);
  }
  return value;
}

// -----------------------------------------------------------------------------
// Public variables — validated in all contexts (browser + server).
// These are bundled into client code by Next.js via NEXT_PUBLIC_ prefix.
// -----------------------------------------------------------------------------

export const NEXT_PUBLIC_SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");

export const NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = requireEnv(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);

export const NEXT_PUBLIC_APP_URL = requireEnv("NEXT_PUBLIC_APP_URL");

// -----------------------------------------------------------------------------
// Server-only variables — validated only on the server.
// typeof window === "undefined" is the standard Next.js guard for server context.
// These variables must NEVER be exposed to the browser.
// -----------------------------------------------------------------------------

export let DATABASE_URL = "";

if (typeof window === "undefined") {
  // Running on the server (Node.js / Edge runtime).
  // Validate and export the server-only database URL.
  DATABASE_URL = requireEnv("DATABASE_URL");
}
