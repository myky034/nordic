import Link from "next/link";
import { SaveButton } from "@/components/save-button";
import { savedState } from "@/lib/workspace/saved";
import { notFound } from "next/navigation";
import { getSource } from "@/lib/registry/queries";
import { canonicalSourceUrl, countryName, crawlPolicyLabels, dateLabel, tierLabel, verificationLabel } from "@/lib/registry/domain";
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
  const save = await savedState("source", source.id);
  return <>
    <PageHeader back={<BackLink href="/sources">Tất cả nguồn</BackLink>} actions={<SaveButton kind="source" id={source.id} signedIn={save.signedIn} initialSaved={save.saved} />} eyebrow="Nguồn" title={source.name}
      description={<div className="flex flex-wrap gap-2 pt-1"><TierBadge tier={source.sourceTier} /><SourceStatusBadge status={source.status}>{verificationLabel(source.status, source.lastVerifiedAt)}</SourceStatusBadge></div>} />
    <DescriptionList items={[
      ["URL", url ? <ExternalLink key="u" href={url}>{url}</ExternalLink> : "URL nguồn cần được xác minh."],
      ["Mức độ nguồn (tier)", tierLabel(source.sourceTier)],
      ["Quốc gia", source.country ? <Link key="c" href={`/countries/${source.country.slug}`} className={textLink}>{countryName(source.country.slug, source.country.name)}</Link> : "Chưa gán quốc gia"],
      ["Loại / ngôn ngữ", `${source.sourceType ?? "Chưa rõ"} / ${source.language ?? "Chưa rõ"}`],
      ["Chủ đề", source.topics.length ? source.topics.join(", ") : "Chưa phân loại"],
      ["Lần crawl gần nhất", dateLabel(source.lastCrawledAt)],
      ["Xác minh gần nhất", dateLabel(source.lastVerifiedAt)],
      ["Crawl", `${source.crawlEnabled ? "Đang bật" : "Đang tắt"} · ${crawlPolicyLabels[source.crawlPolicy as keyof typeof crawlPolicyLabels] ?? source.crawlPolicy}`],
      ["Tần suất crawl", source.crawlFrequency ?? "Chưa lên lịch"],
      ["Căn cứ xác minh", source.authorityNotes ?? "Chưa kiểm tra"],
      ...(source.notes ? [["Ghi chú", source.notes] as [string, string]] : []),
    ]} />
    <p className="mt-3 px-1 text-[13px] text-ink-3">Tier và việc xác minh mô tả nguồn, không chứng minh mọi câu nguồn đăng đều đúng.</p>
    <Section title="Tài liệu từ nguồn này" actions={source._count.documents > source.documents.length && host ? <Link href={`/documents?q=${encodeURIComponent(host)}`} className={`${textLink} text-[15px]`}>Xem tất cả {source._count.documents}</Link> : undefined}>
      {source.documents.length ? <List label="Tài liệu">{source.documents.map((d) => <ListRow key={d.id} href={`/documents/${d.id}`} title={d.title ?? "Tài liệu chưa có tiêu đề"} subtitle={`Lấy trang ngày ${dateLabel(d.retrievedAt)}`} />)}</List>
        : <EmptyState>Chưa có tài liệu nào được nhập từ nguồn này.</EmptyState>}
    </Section>
  </>;
}
