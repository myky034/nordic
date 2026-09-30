import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { accountLinks } from "@/lib/rbac/ui";
import { pendingProposalTotal } from "@/lib/review/pending-total";

const pill = "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition";

/**
 * Account area of the global header, the same on every page (public and
 * signed-in), so sign-out never disappears.
 *
 * What is shown depends on the viewer (lib/rbac/ui.ts):
 * - signed out: "Đăng nhập";
 * - signed in: "Không gian của tôi" (own projects, saved items, plan);
 * - editors: also "Biên tập" (the dashboard with work queues), with the number
 *   of proposals waiting for reviewers.
 * Display only: every editor page and action checks permissions itself.
 */
export async function AccountActions() {
  const links = accountLinks(await viewerPermissions());
  if (!links.signedIn) {
    return <Link href="/login" className={`${pill} bg-ink text-canvas hover:opacity-85`}>Đăng nhập</Link>;
  }
  return <div className="flex items-center gap-2">
    {links.editor && <Link href={links.editor.href} className={`${pill} bg-ink text-canvas hover:opacity-85`}>
      {links.editor.label}
      {/* The count needs several queries; it streams in after the page instead of delaying it. */}
      {links.editor.showPending && <Suspense fallback={null}><PendingBadge /></Suspense>}
    </Link>}
    {/* With an editor button present, the personal link moves to the dashboard tiles on narrow screens. */}
    <Link href={links.personal.href} className={`${pill} ${links.editor ? "hidden sm:inline-flex bg-fill text-ink hover:bg-fill-strong" : "bg-ink text-canvas hover:opacity-85"}`}>{links.personal.label}</Link>
    <form action={signOut}>
      <button type="submit" className={`${pill} bg-fill text-ink hover:bg-fill-strong`}>Đăng xuất</button>
    </form>
  </div>;
}

/** Proposals waiting for review, as a small badge; nothing when zero or when counting failed. */
export async function PendingBadge() {
  const pending = await pendingProposalTotal();
  if (!pending) return null;
  return <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] font-semibold leading-5 text-white tabular-nums">
    <span className="sr-only">, </span>{pending > 99 ? "99+" : pending}<span className="sr-only"> đề xuất chờ duyệt</span>
  </span>;
}
