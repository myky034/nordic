import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";

export type PermissionKey = "facts.propose" | "facts.review" | "documents.read" | "documents.ingest" | "users.assign_roles" | "roles.manage" | "sources.manage" | "education.manage" | "immigration.manage" | "labour.manage" | "metrics.manage" | "crawler.manage" | "taxonomy.manage";
/**
 * The signed-in user's permission keys, fetched once per request.
 *
 * WHY React cache(): the header (lib/rbac/viewer.ts) and the page both need
 * the permissions; each Supabase round trip costs ~0.5 s from here, so
 * asking once per request instead of twice is a visible speed-up. cache()
 * is scoped to a single request, so nothing leaks between users.
 */
export const myPermissionKeys = cache(async () => {
  const client = await createClient();
  const result = await client.rpc("my_permissions");
  if (result.error) { logAccessError("permissions_read"); throw new Error("access_unavailable"); }
  return (result.data as { key: string }[]).map((row) => row.key);
});

/**
 * Who is asking and what they may do. getUser() (a network check with Supabase
 * Auth) and the permission lookup run in parallel instead of one after the
 * other; an unauthenticated result still wins, so the check is unchanged.
 */
export const accessContext = cache(async () => {
  const client = await createClient();
  const [{ data, error }, permissions] = await Promise.all([
    client.auth.getUser(),
    myPermissionKeys().catch((e: unknown) => e as Error),
  ]);
  if (error || !data.user) throw new Error("access_unauthenticated");
  if (permissions instanceof Error) throw permissions;
  return { client, userId: data.user.id, permissions };
});
export async function requirePermission(key: PermissionKey) {
  const context = await accessContext();
  if (!context.permissions.includes(key)) throw new Error("access_forbidden");
  return context;
}
export function logAccessError(operation: string) {
  console.error({ source: "rbac", operation, timestamp: new Date().toISOString(), status: "failed", category: "access_operation_failed" });
}

export type RoleRow = { id: string; name: string; description: string; role_permissions: { permission_key: string }[] };
export type UserRow = { user_id: string; email: string | null; role_ids: string[] };
export type AuditRow = { id: string; actor_id: string | null; action: string; target_id: string | null; details: unknown; created_at: string };
