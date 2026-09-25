import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocument, documentVersions } from "@/lib/documents/queries";
import { canonicalSourceUrl, dateLabel, tierLabel } from "@/lib/registry/domain";
import { BackLink, Badge, DescriptionList, EmptyState, ExternalLink, List, ListRow, PageHeader, Quote, Section } from "@/components/ui";
import { buttonPrimary, textLink } from "@/components/ui/styles";
import { InternalText } from "./internal-text";

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  const document = await getDocument(id);
  if (!document) notFound();
  const versions = await documentVersions(document.sourceId, document.canonicalUrl);
  const url = canonicalSourceUrl(document.canonicalUrl);
  const sourceUrl = canonicalSourceUrl(document.source.canonicalUrl);
  return <>
    <PageHeader back={<BackLink href="/documents">All documents</BackLink>} eyebrow="Document"
      title={<span className="break-words">{document.title ?? "Untitled document"}</span>}
      description={<div className="flex flex-wrap gap-2 pt-1"><Badge>Metadata stored · Extraction not started · Claims not verified</Badge></div>}
      actions={<Link href={`/facts/workspace?document=${id}`} className={buttonPrimary}>Thêm thông tin & bằng chứng</Link>} />
    {url && <p className="-mt-4 mb-10 text-[15px]"><ExternalLink href={url}>Read original: {url}</ExternalLink></p>}
    <DescriptionList items={[
      ["Source", sourceUrl ? <a href={sourceUrl} className={textLink}>{document.source.name}</a> : document.source.name],
      ["Source tier", tierLabel(document.source.sourceTier)],
      ["Retrieved", dateLabel(document.retrievedAt)],
      ["Published", dateLabel(document.publishedAt)],
      ["Source updated", dateLabel(document.sourceUpdatedAt)],
      ["Document type", document.documentType],
      ["Document verification", "Not verified; current validity unknown"],
      ["Registry metadata last reviewed", dateLabel(document.source.lastVerifiedAt)],
    ]} />
    <Section title="Source excerpt" description="An excerpt records source text; it is not a verified fact or legal advice.">
      {document.excerpt ? <Quote>{document.excerpt}</Quote> : <EmptyState>No excerpt supplied. Read the original source for context.</EmptyState>}
    </Section>
    <InternalText documentId={id} />
    <Section title="Recorded versions" description={<>Versions preserve changes without selecting one as authoritative.{versions.length > 20 ? " Showing the 20 most recently retrieved versions." : ""}</>}>
      {versions.length ? <List label="Versions">{versions.slice(0, 20).map((version) => <ListRow key={version.id} href={`/documents/${version.id}`}
        title={`Retrieved ${dateLabel(version.retrievedAt)}`}
        badges={version.id === id ? <Badge tone="accent">This version</Badge> : undefined}
        meta={<span className="font-mono">{version.contentHash.slice(0, 12)}</span>} />)}</List>
        : <EmptyState>No other versions recorded.</EmptyState>}
    </Section>
  </>;
}
