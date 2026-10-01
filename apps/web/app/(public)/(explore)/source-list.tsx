import type { Source } from "@nordic/db";
import { canonicalSourceUrl, countryName, verificationLabel } from "@/lib/registry/domain";
import { EmptyState, List, ListRow } from "@/components/ui";
import { SourceStatusBadge, TierBadge } from "@/components/ui/badges";

// Compact rows: name, tier, verification, host and country on two lines. The
// full registry metadata lives on /sources/[id] instead of inside every row.
export function hostLabel(url: string | null) {
  if (!url) return null;
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return null; }
}
export function SourceList({ sources }: { sources: (Source & { country?: { name: string; slug: string } | null })[] }) {
  if (!sources.length) return <EmptyState>Không có nguồn nào khớp lựa chọn này. Phạm vi quốc gia không được suy đoán từ các URL ban đầu.</EmptyState>;
  return <List label="Nguồn">{sources.map((source) => {
    const host = hostLabel(canonicalSourceUrl(source.canonicalUrl));
    return <ListRow key={source.id} href={`/sources/${source.id}`} title={source.name}
      badges={<><TierBadge tier={source.sourceTier} /><SourceStatusBadge status={source.status}>{verificationLabel(source.status, source.lastVerifiedAt)}</SourceStatusBadge></>}
      subtitle={`${host ?? "URL nguồn cần được xác minh."} · ${source.country ? countryName(source.country.slug, source.country.name) : "Chưa gán quốc gia"}${source.topics.length ? ` · ${source.topics.join(", ")}` : ""}`} />;
  })}</List>;
}
