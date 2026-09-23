import type { Source } from "@nordic/db";
import { canonicalSourceUrl, verificationLabel } from "@/lib/registry/domain";
import { EmptyState, List, ListRow } from "@/components/ui";
import { SourceStatusBadge, TierBadge } from "@/components/ui/badges";

// Compact rows: name, tier, verification, host and country on two lines. The
// full registry metadata lives on /sources/[id] instead of inside every row.
export function hostLabel(url: string | null) {
  if (!url) return null;
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return null; }
}
export function SourceList({ sources }: { sources: (Source & { country?: { name: string; slug: string } | null })[] }) {
  if (!sources.length) return <EmptyState>No sources found for this selection. Country coverage has not been inferred from the seed URLs.</EmptyState>;
  return <List label="Sources">{sources.map((source) => {
    const host = hostLabel(canonicalSourceUrl(source.canonicalUrl));
    return <ListRow key={source.id} href={`/sources/${source.id}`} title={source.name}
      badges={<><TierBadge tier={source.sourceTier} /><SourceStatusBadge status={source.status}>{verificationLabel(source.status, source.lastVerifiedAt)}</SourceStatusBadge></>}
      subtitle={`${host ?? "Source URL needs verification."} · ${source.country?.name ?? "Not assigned"}${source.topics.length ? ` · ${source.topics.join(", ")}` : ""}`} />;
  })}</List>;
}
