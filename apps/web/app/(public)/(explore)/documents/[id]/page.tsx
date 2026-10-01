import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocument, documentVersions } from "@/lib/documents/queries";
import { canonicalSourceUrl, dateLabel, tierLabel } from "@/lib/registry/domain";
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
  return <>
    <PageHeader back={<BackLink href="/documents">Tất cả tài liệu</BackLink>} eyebrow="Tài liệu"
      title={<span className="break-words">{document.title ?? "Tài liệu chưa có tiêu đề"}</span>}
      description={<div className="flex flex-wrap gap-2 pt-1"><Badge>Đã lưu thông tin trang · Nội dung chưa được kiểm chứng</Badge></div>}
      actions={canPropose ? <Link href={`/facts/workspace?document=${id}`} className={buttonPrimary}>Thêm thông tin & bằng chứng</Link> : undefined} />
    {url && <p className="-mt-4 mb-10 text-[15px]"><ExternalLink href={url}>Mở trang gốc: {url}</ExternalLink></p>}
    <DescriptionList items={[
      ["Nguồn", sourceUrl ? <a href={sourceUrl} className={textLink}>{document.source.name}</a> : document.source.name],
      ["Mức độ nguồn (tier)", tierLabel(document.source.sourceTier)],
      ["Ngày lấy trang", dateLabel(document.retrievedAt)],
      ["Ngày nguồn đăng", dateLabel(document.publishedAt)],
      ["Ngày nguồn cập nhật", dateLabel(document.sourceUpdatedAt)],
      ["Loại tài liệu", document.documentType],
      ["Kiểm chứng nội dung", "Chưa kiểm chứng; hiệu lực hiện tại chưa rõ"],
      ["Nguồn xác minh gần nhất", dateLabel(document.source.lastVerifiedAt)],
    ]} />
    <Section title="Trích đoạn" description="Trích đoạn chép lại chữ của nguồn; nó không phải thông tin đã kiểm chứng hay tư vấn pháp lý.">
      {document.excerpt ? <Quote>{document.excerpt}</Quote> : <EmptyState>Chưa có trích đoạn. Hãy đọc trang gốc để biết ngữ cảnh.</EmptyState>}
    </Section>
    <InternalText documentId={id} />
    <ExtractionPanel documentId={id} />
    <Section title="Các phiên bản đã lưu" description={<>Mỗi lần trang nguồn đổi nội dung là một phiên bản mới; hệ thống giữ tất cả, không chọn bản nào là đúng.{versions.length > 20 ? " Đang hiện 20 phiên bản mới nhất." : ""}</>}>
      {versions.length ? <List label="Phiên bản">{versions.slice(0, 20).map((version) => <ListRow key={version.id} href={`/documents/${version.id}`}
        title={`Lấy trang ngày ${dateLabel(version.retrievedAt)}`}
        badges={version.id === id ? <Badge tone="accent">Phiên bản này</Badge> : undefined}
        meta={<span className="font-mono">{version.contentHash.slice(0, 12)}</span>} />)}</List>
        : <EmptyState>Chưa có phiên bản nào khác.</EmptyState>}
    </Section>
  </>;
}
