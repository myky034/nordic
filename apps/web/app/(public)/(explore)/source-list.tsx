import type { Source } from "@nordic/db";
import { canonicalSourceUrl, countryName, verificationLabel } from "@/lib/registry/domain";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import { EmptyState, List, ListRow } from "@/components/ui";
import { SourceStatusBadge, TierBadge } from "@/components/ui/badges";

// Compact rows: name, tier, verification, host and country on two lines. The
// full registry metadata lives on /sources/[id] instead of inside every row.
export function hostLabel(url: string | null) {
  if (!url) return null;
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return null; }
}
export function SourceList({ sources, locale = defaultLocale }: { sources: (Source & { country?: { name: string; slug: string } | null })[]; locale?: Locale }) {
  const t = dictionaries[locale].sources;
  if (!sources.length) return <EmptyState>{t.empty}</EmptyState>;
  return <List label={t.title}>{sources.map((source) => {
    const host = hostLabel(canonicalSourceUrl(source.canonicalUrl));
    return <ListRow key={source.id} href={`/sources/${source.id}`} title={source.name}
      badges={<><TierBadge tier={source.sourceTier} locale={locale} /><SourceStatusBadge status={source.status}>{verificationLabel(source.status, source.lastVerifiedAt, locale)}</SourceStatusBadge></>}
      subtitle={`${host ?? t.sourceUrlUnverified} · ${source.country ? countryName(source.country.slug, source.country.name, locale) : t.unassignedCountry}${source.topics.length ? ` · ${source.topics.join(", ")}` : ""}`} />;
  })}</List>;
}
