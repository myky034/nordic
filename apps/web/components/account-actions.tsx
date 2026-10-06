import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { accountLinks } from "@/lib/rbac/ui";
import { pendingProposalTotal } from "@/lib/review/pending-total";
import { getDictionary } from "@/lib/i18n/server";

const pill = "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition";

/**
 * Account area of the global header, the same on every page (public and
 * signed-in), so sign-out never disappears.
 *
 * What is shown depends on the viewer (lib/rbac/ui.ts):
 * - signed out: sign in;
 * - signed in: their own workspace (projects, saved items, plan);
 * - editors: also the editing dashboard with work queues, with the number
 *   of proposals waiting for reviewers.
 * Labels come from the viewer's dictionary (lib/i18n).
 * Display only: every editor page and action checks permissions itself.
 */
export async function AccountActions() {
  const [links, t] = [accountLinks(await viewerPermissions()), (await getDictionary()).account];
  if (!links.signedIn) {
    return <Link href="/login" className={`${pill} bg-ink text-canvas hover:opacity-85`}>{t.signIn}</Link>;
  }
  return <div className="flex items-center gap-2">
    {links.editor && <Link href={links.editor.href} className={`${pill} bg-ink text-canvas hover:opacity-85`}>
      {t.editor}
      {/* The count needs several queries; it streams in after the page instead of delaying it. */}
      {links.editor.showPending && <Suspense fallback={null}><PendingBadge /></Suspense>}
    </Link>}
    {/* With an editor button present, the personal link moves to the dashboard tiles on narrow screens. */}
    <Link href={links.personal.href} className={`${pill} ${links.editor ? "hidden sm:inline-flex bg-fill text-ink hover:bg-fill-strong" : "bg-ink text-canvas hover:opacity-85"}`}>{t.personal}</Link>
    <form action={signOut}>
      <button type="submit" className={`${pill} bg-fill text-ink hover:bg-fill-strong`}>{t.signOut}</button>
    </form>
  </div>;
}

/** Proposals waiting for review, as a small badge; nothing when zero or when counting failed. */
export async function PendingBadge() {
  const [pending, t] = [await pendingProposalTotal(), (await getDictionary()).account];
  if (!pending) return null;
  return <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] font-semibold leading-5 text-white tabular-nums">
    <span className="sr-only">, </span>{pending > 99 ? "99+" : pending}<span className="sr-only"> {t.pending}</span>
  </span>;
}
