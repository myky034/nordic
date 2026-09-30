import Link from "next/link";
import { getAuthClaims } from "@/lib/auth/session";
import { signOut } from "@/app/(auth)/actions";

/**
 * Account area of the global header, the same on every page.
 *
 * WHY here and not in each layout: the public layout used to render a fixed
 * "Workspace" link and only the (app) layout had "Sign out", so a signed-in
 * user lost the sign-out button as soon as they opened a public page.
 *
 * getAuthClaims() verifies the JWT locally (no network call). Reading the
 * session cookie makes pages under this header render per request, which the
 * explore pages already do.
 */
export async function AccountActions() {
  const claims = await getAuthClaims();
  if (!claims) {
    return <Link href="/login" className="inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-canvas transition hover:opacity-85">Đăng nhập</Link>;
  }
  return <div className="flex items-center gap-2">
    <Link href="/dashboard" className="inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-canvas transition hover:opacity-85">Workspace</Link>
    <form action={signOut}>
      <button type="submit" className="rounded-full bg-fill px-3.5 py-1.5 text-[13px] font-medium text-ink transition hover:bg-fill-strong">Đăng xuất</button>
    </form>
  </div>;
}
