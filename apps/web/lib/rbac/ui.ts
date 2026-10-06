import { visibleGroups } from "@/lib/dashboard/items";

// Which buttons a viewer sees, by permission. Kept out of components so the
// rules are testable and live in one place (AGENTS.md 16).
//
// This is DISPLAY only. Hiding a button is not access control: every editor
// page, Server Action and RLS policy still checks permissions itself, so a
// visible-but-forbidden or hidden-but-typed URL behaves exactly as before.

/** null = signed out; [] = signed in without special permissions. */
export type ViewerPermissions = readonly string[] | null;

/**
 * An editor is anyone who would see an editing or administration tile on the
 * dashboard — the same lists (lib/dashboard/items.ts), so the header and the
 * dashboard can never disagree.
 */
export function isEditor(p: ViewerPermissions) {
  return !!p && visibleGroups([...p]).some((g) => g.id === "editing" || g.id === "admin");
}
/**
 * Operational details on public pages — crawl state and schedule, authority
 * notes and internal source notes, the AI model and AI origin of a fact, the
 * "reviewed" badge, a country's research status — are for the people who run
 * the registry: anyone with an editing or admin area (owner decision,
 * 2026-10-02). Visitors still see everything the rules require: source, URL,
 * tier, verification and retrieval dates, validity, conflicts and changed-
 * source warnings (AGENTS.md §1.5, §12, §23). Display only; nothing here is
 * a permission check.
 */
export const seesInternalDetails = (p: ViewerPermissions) => isEditor(p);
export const canProposeFacts = (p: ViewerPermissions) => !!p?.includes("facts.propose");
export const canReview = (p: ViewerPermissions) => !!p?.includes("facts.review");
export const canOpenFactsWorkspace = (p: ViewerPermissions) => canProposeFacts(p) || canReview(p);

export type AccountLinks =
  | { signedIn: false }
  | { signedIn: true; personal: { href: string }; editor: { href: string; showPending: boolean } | null };

/**
 * Header account area. Everyone signed in gets "Không gian của tôi" (their
 * projects, saved items, plan). Editors also get "Biên tập" (the dashboard
 * with the work queues); reviewers see how much is waiting there.
 */
export function accountLinks(p: ViewerPermissions): AccountLinks {
  if (!p) return { signedIn: false };
  return {
    signedIn: true,
    personal: { href: "/workspace" },
    editor: isEditor(p) ? { href: "/dashboard", showPending: canReview(p) } : null,
  };
}
