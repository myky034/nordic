import "server-only";
import { createClient } from "../supabase/server";

export type PermissionKey = "facts.propose" | "facts.review" | "documents.read" | "documents.ingest" | "users.assign_roles" | "roles.manage" | "sources.manage";
export async function accessContext() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("access_unauthenticated");
  const result = await client.rpc("my_permissions");
  if (result.error) { logAccessError("permissions_read"); throw new Error("access_unavailable"); }
  return { client, userId: data.user.id, permissions: (result.data as { key: string }[]).map((row) => row.key) };
}
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
