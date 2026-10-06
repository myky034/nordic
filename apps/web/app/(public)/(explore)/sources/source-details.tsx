import Link from "next/link";
import type { getSource } from "@/lib/registry/queries";
import { canonicalSourceUrl, countryName, crawlPolicyLabel, dateLabel, tierLabel } from "@/lib/registry/domain";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import { DescriptionList, EmptyState, ExternalLink, List, ListRow, Section } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import { hostLabel } from "../source-list";

export type SourceDetail = NonNullable<Awaited<ReturnType<typeof getSource>>>;

// Registry metadata and recent documents of one source. Shared by the full
// page (/sources/[id]) and the slide-over Inspector on /sources, so both show
// the same facts with the same wording for unknowns. `compact` = Inspector
// (narrower panel, smaller section heading).
// `internal` adds crawl state, authority notes and internal notes (editors only,
// seesInternalDetails() in lib/rbac/ui.ts).
export function SourceDetails({ source, compact = false, internal = false, locale = defaultLocale }: { source: SourceDetail; compact?: boolean; internal?: boolean; locale?: Locale }) {
  const t = dictionaries[locale].sources.details, c = dictionaries[locale].common, s = dictionaries[locale].sources;
  const url = canonicalSourceUrl(source.canonicalUrl);
  const host = hostLabel(url);
  const more = source._count.documents > source.documents.length && host
    ? <Link href={`/documents?q=${encodeURIComponent(host)}`} className={`${textLink} text-[15px]`}>{c.seeAllCount(source._count.documents)}</Link> : undefined;
  const documents = source.documents.length
    ? <List label={t.documentsLabel}>{source.documents.map((d) => <ListRow key={d.id} href={`/documents/${d.id}`} title={d.title ?? c.untitledDocument} subtitle={c.retrievedOn(dateLabel(d.retrievedAt, locale))} />)}</List>
    : <EmptyState>{t.noDocuments}</EmptyState>;
  return <>
    <DescriptionList items={[
      // canonicalSourceUrl() returns null for anything but http(s), so an unsafe stored URL is never a link.
      [t.url, url ? <ExternalLink key="u" href={url}>{url}</ExternalLink> : s.sourceUrlUnverified],
      [t.tier, tierLabel(source.sourceTier, locale)],
      [t.country, source.country ? <Link key="c" href={`/countries/${source.country.slug}`} className={textLink}>{countryName(source.country.slug, source.country.name, locale)}</Link> : s.unassignedCountry],
      [t.typeLanguage, `${source.sourceType ?? t.unknown} / ${source.language ?? t.unknown}`],
      [t.topics, source.topics.length ? source.topics.join(", ") : t.unclassified],
      [t.lastVerified, dateLabel(source.lastVerifiedAt, locale)],
      ...(internal ? [
        [t.lastCrawled, dateLabel(source.lastCrawledAt, locale)],
        [t.crawl, `${source.crawlEnabled ? t.crawlOn : t.crawlOff} · ${crawlPolicyLabel(source.crawlPolicy, locale)}`],
        [t.crawlFrequency, source.crawlFrequency ?? t.notScheduled],
        [t.authority, source.authorityNotes ?? t.notChecked],
        ...(source.notes ? [[t.internalNotes, source.notes] as [string, string]] : []),
      ] as [string, React.ReactNode][] : []),
    ]} />
    <p className="mt-3 px-1 text-[13px] text-ink-3">{t.tierNote}</p>
    {compact
      ? <div className="mt-8"><div className="mb-3 flex items-end justify-between gap-3 px-1"><h3 className="text-[17px] font-semibold text-ink">{t.documents}</h3>{more}</div>{documents}</div>
      : <Section title={t.documents} actions={more}>{documents}</Section>}
  </>;
}
