import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocument, documentVersions } from "@/lib/documents/queries";
import { canonicalSourceUrl, dateLabel, tierLabel } from "@/lib/registry/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";

import { BackLink, Badge, DescriptionList, EmptyState, ExternalLink, List, ListRow, PageHeader, Quote, Section } from "@/components/ui";
import { buttonPrimary, textLink } from "@/components/ui/styles";
import { InternalText } from "./internal-text";
import { ExtractionPanel } from "./extraction-panel";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { canProposeFacts } from "@/lib/rbac/ui";

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  const document = await getDocument(id);
  if (!document) notFound();
  const versions = await documentVersions(document.sourceId, document.canonicalUrl);
  const url = canonicalSourceUrl(document.canonicalUrl);
  const sourceUrl = canonicalSourceUrl(document.source.canonicalUrl);
  // Only people who can propose facts see the shortcut into the workspace.
  const canPropose = canProposeFacts(await viewerPermissions());
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const [t, c] = [dict.documents, dict.common];
  return <>
    <PageHeader back={<BackLink href="/documents">{t.back}</BackLink>} eyebrow={t.eyebrow}
      title={<span className="break-words">{document.title ?? c.untitledDocument}</span>}
      description={<div className="flex flex-wrap gap-2 pt-1"><Badge>{t.savedBadge}</Badge></div>}
      actions={canPropose ? <Link href={`/facts/workspace?document=${id}`} className={buttonPrimary}>{t.addFact}</Link> : undefined} />
    {url && <p className="-mt-4 mb-10 text-[15px]"><ExternalLink href={url}>{t.openOriginal(url)}</ExternalLink></p>}
    <DescriptionList items={[
      [t.source, sourceUrl ? <a href={sourceUrl} className={textLink}>{document.source.name}</a> : document.source.name],
      [t.tier, tierLabel(document.source.sourceTier, locale)],
      [t.retrieved, dateLabel(document.retrievedAt, locale)],
      [t.published, dateLabel(document.publishedAt, locale)],
      [t.updated, dateLabel(document.sourceUpdatedAt, locale)],
      [t.type, document.documentType],
      [t.contentCheck, t.contentNotChecked],
      [t.sourceLastVerified, dateLabel(document.source.lastVerifiedAt, locale)],
    ]} />
    <Section title={t.excerpt} description={t.excerptDescription}>
      {document.excerpt ? <Quote>{document.excerpt}</Quote> : <EmptyState>{t.noExcerpt}</EmptyState>}
    </Section>
    <InternalText documentId={id} />
    <ExtractionPanel documentId={id} />
    <Section title={t.versions} description={<>{t.versionsDescription}{versions.length > 20 ? t.latest20 : ""}</>}>
      {versions.length ? <List label={t.versionsLabel}>{versions.slice(0, 20).map((version) => <ListRow key={version.id} href={`/documents/${version.id}`}
        title={c.retrievedOn(dateLabel(version.retrievedAt, locale))}
        badges={version.id === id ? <Badge tone="accent">{t.thisVersion}</Badge> : undefined}
        meta={<span className="font-mono">{version.contentHash.slice(0, 12)}</span>} />)}</List>
        : <EmptyState>{t.noVersions}</EmptyState>}
    </Section>
  </>;
}
