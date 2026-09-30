import "server-only";
import { cache } from "react";
import { getAuthClaims } from "@/lib/auth/session";
import { myPermissionKeys } from "./access";

/**
 * The current viewer's permission keys, for deciding which buttons to show:
 * null when signed out, [] when signed in without special permissions.
 *
 * WHY React cache(): the header and the page both ask during one request;
 * cache() makes that one `my_permissions` call instead of several.
 *
 * If the permission lookup fails, the viewer is treated as having none:
 * editor buttons stay hidden (fail closed); myPermissionKeys logs the failure. This is
 * display only — pages and actions enforce permissions themselves.
 */
export const viewerPermissions = cache(async (): Promise<string[] | null> => {
  const claims = await getAuthClaims();
  if (!claims) return null;
  // Same cached lookup as accessContext(), so a page and its header share one call.
  try { return await myPermissionKeys(); } catch { return []; }
});
