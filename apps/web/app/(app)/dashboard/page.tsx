// =============================================================================
// Dashboard Page — app/(app)/dashboard/page.tsx  →  route: /dashboard
// =============================================================================
//
// Landing page for signed-in users. Apple-style overview (iCloud home /
// Health summary): a "needs attention" row of counts, then grouped app-style
// tiles. Which tiles and counters appear is decided in lib/dashboard/items.ts
// from the user's permissions; this page only renders.
//
// WHY both requireAuth() and getCurrentUser() here?
//   - requireAuth() (backed by getClaims) ensures we bail out fast if the
//     token is somehow invalid — it does not make a network call.
//   - getCurrentUser() makes a network call to get the actual user record
//     with email, metadata, etc. We call it here because we want to DISPLAY
//     the user's email — an appropriate reason for the extra round-trip.
//   The layout already called requireAuth(), but we call it again here per
//   the Next.js recommendation to check auth close to the data that needs it.
// =============================================================================

import { requireAuth } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { counterLabel, localizeGroups, visibleCounters, visibleGroups, type CounterId } from "@/lib/dashboard/items";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { PageHeader, Section } from "@/components/ui";
import { CounterTile, TileLink } from "./tiles";

export default async function DashboardPage() {
  // Verify identity via JWT claims — fast, no network call.
  await requireAuth();

  // Fetch the user record to display their email.
  const user = await getCurrentUser();
  const { client, permissions } = await accessContext();
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.dashboard;
  const groups = localizeGroups(visibleGroups(permissions), locale);
  const shown = visibleCounters(permissions);

  // Head-only counts through the user's own client: RLS scopes every number.
  // A failed count is shown as unknown ("—"), never as zero (AGENTS.md §13).
  const queries: Record<CounterId, () => PromiseLike<{ count: number | null; error: unknown }>> = {
    proposed: () => client.from("facts").select("id", { count: "exact", head: true }).eq("status", "proposed"),
    sourceChanged: () => client.from("facts").select("id", { count: "exact", head: true }).not("source_changed_at", "is", null),
    extractionPending: () => client.from("extraction_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "running"]),
    sourcesUnverified: () => client.from("sources").select("id", { count: "exact", head: true }).eq("status", "needs_verification"),
  };
  const values = await Promise.all(shown.map(async (c) => {
    const { count, error } = await queries[c.id]();
    if (error) { logAccessError(`dashboard_count_${c.id}`); return null; }
    return count ?? 0;
  }));

  return (
    <>
      <PageHeader eyebrow="Nordic" title={t.title}
        description={<>{t.signedInAs} <span className="font-medium text-ink">{user?.email ?? "unknown"}</span></>} />
      {shown.length > 0 && <Section title={t.needsAttention}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {shown.map((c, i) => <CounterTile key={c.id} label={counterLabel(c, locale)} href={c.href} value={values[i]} words={t} />)}
        </div>
      </Section>}
      {groups.map((g) => <Section key={g.id} title={g.title}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{g.tiles.map((t) => <TileLink key={t.href} tile={t} />)}</div>
      </Section>)}
    </>
  );
}
