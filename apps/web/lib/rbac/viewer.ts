import "server-only";
import { cache } from "react";
import { getAuthClaims } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "./access";

/**
 * The current viewer's permission keys, for deciding which buttons to show:
 * null when signed out, [] when signed in without special permissions.
 *
 * WHY React cache(): the header and the page both ask during one request;
 * cache() makes that one `my_permissions` call instead of several.
 *
 * If the permission lookup fails, the viewer is treated as having none:
 * editor buttons stay hidden (fail closed) and the failure is logged. This is
 * display only — pages and actions enforce permissions themselves.
 */
export const viewerPermissions = cache(async (): Promise<string[] | null> => {
  const claims = await getAuthClaims();
  if (!claims) return null;
  const client = await createClient();
  const { data, error } = await client.rpc("my_permissions");
  if (error) { logAccessError("viewer_permissions"); return []; }
  return (data as { key: string }[]).map((row) => row.key);
});
