import Link from "next/link";
import { notFound } from "next/navigation";
import { getSource } from "@/lib/registry/queries";
import { canonicalSourceUrl, dateLabel, tierLabel, verificationLabel } from "@/lib/registry/domain";
import { BackLink, DescriptionList, EmptyState, ExternalLink, List, ListRow, PageHeader, Section } from "@/components/ui";
import { SourceStatusBadge, TierBadge } from "@/components/ui/badges";
import { textLink } from "@/components/ui/styles";
import { hostLabel } from "../../source-list";

export default async function SourcePage({ params }: PageProps<"/sources/[id]">) {
  const { id } = await params;
  const source = await getSource(id);
  if (!source) notFound();
  const url = canonicalSourceUrl(source.canonicalUrl);
  const host = hostLabel(url);
  return <>
    <PageHeader back={<BackLink href="/sources">Source registry</BackLink>} eyebrow="Source" title={source.name}
      description={<div className="flex flex-wrap gap-2 pt-1"><TierBadge tier={source.sourceTier} /><SourceStatusBadge status={source.status}>{verificationLabel(source.status, source.lastVerifiedAt)}</SourceStatusBadge></div>} />
    <DescriptionList items={[
      ["URL", url ? <ExternalLink key="u" href={url}>{url}</ExternalLink> : "Source URL needs verification."],
      ["Source tier", tierLabel(source.sourceTier)],
      ["Country", source.country ? <Link key="c" href={`/countries/${source.country.slug}`} className={textLink}>{source.country.name}</Link> : "Not assigned"],
      ["Type / language", `${source.sourceType ?? "Unknown"} / ${source.language ?? "Unknown"}`],
      ["Topics", source.topics.length ? source.topics.join(", ") : "Not classified"],
      ["Last crawled", dateLabel(source.lastCrawledAt)],
      ["Last registry verification", dateLabel(source.lastVerifiedAt)],
      ["Crawling", `${source.crawlEnabled ? "Enabled" : "Disabled"} · ${source.crawlPolicy.replaceAll("_", " ")}`],
      ["Crawl frequency", source.crawlFrequency ?? "Not scheduled"],
      ["Authority evidence", source.authorityNotes ?? "Not reviewed"],
      ...(source.notes ? [["Notes", source.notes] as [string, string]] : []),
    ]} />
    <p className="mt-3 px-1 text-[13px] text-ink-3">Tier and registry review describe the source, not the correctness of every statement it publishes.</p>
    <Section title="Documents from this source" actions={source._count.documents > source.documents.length && host ? <Link href={`/documents?q=${encodeURIComponent(host)}`} className={`${textLink} text-[15px]`}>All {source._count.documents}</Link> : undefined}>
      {source.documents.length ? <List label="Documents">{source.documents.map((d) => <ListRow key={d.id} href={`/documents/${d.id}`} title={d.title ?? "Untitled document"} subtitle={`Retrieved ${dateLabel(d.retrievedAt)}`} />)}</List>
        : <EmptyState>No documents have been imported from this source yet.</EmptyState>}
    </Section>
  </>;
}
