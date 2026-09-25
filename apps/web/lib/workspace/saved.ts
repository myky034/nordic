import "server-only";
import { createClient } from "../supabase/server";
import { getAuthClaims } from "../auth/session";
import { itemKinds, type ItemKind } from "./domain";

/**
 * Whether the current visitor is signed in and has bookmarked this item.
 * Uses local JWT verification (no network call) and the owner-only RLS table,
 * so it can only ever see the visitor's own bookmark.
 */
export async function savedState(kind: ItemKind, id: string) {
  const claims = await getAuthClaims();
  if (!claims) return { signedIn: false, saved: false };
  const client = await createClient();
  const { data, error } = await client.from("saved_items").select("id").eq(itemKinds[kind].column, id).maybeSingle();
  // A failed lookup must not block the public page; show "not saved".
  return { signedIn: true, saved: !error && !!data };
}
