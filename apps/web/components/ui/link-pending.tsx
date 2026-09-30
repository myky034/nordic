"use client";
import { useLinkStatus } from "next/link";

/**
 * A small spinner inside a <Link> while its navigation is pending.
 *
 * WHY: every row, tab and pager on the workspace pages is a server-rendered
 * link, and each Supabase round trip takes ~0.5 s from here; without feedback
 * a click looked like it did nothing. useLinkStatus (next/link) reports the
 * pending state of the enclosing Link. The spinner fades in after a short
 * delay, so fast navigations do not flicker. Must be rendered inside a Link.
 */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true"
    className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-accent/25 border-t-accent align-middle transition-opacity ${pending ? "animate-spin opacity-100 delay-100" : "opacity-0"} ${className}`} />;
}
