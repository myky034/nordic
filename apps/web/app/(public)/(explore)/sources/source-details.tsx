import Link from "next/link";
import type { getSource } from "@/lib/registry/queries";
import { canonicalSourceUrl, countryName, crawlPolicyLabels, dateLabel, tierLabel } from "@/lib/registry/domain";
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
export function SourceDetails({ source, compact = false, internal = false }: { source: SourceDetail; compact?: boolean; internal?: boolean }) {
  const url = canonicalSourceUrl(source.canonicalUrl);
  const host = hostLabel(url);
  const more = source._count.documents > source.documents.length && host
    ? <Link href={`/documents?q=${encodeURIComponent(host)}`} className={`${textLink} text-[15px]`}>Xem tất cả {source._count.documents}</Link> : undefined;
  const documents = source.documents.length
    ? <List label="Tài liệu">{source.documents.map((d) => <ListRow key={d.id} href={`/documents/${d.id}`} title={d.title ?? "Tài liệu chưa có tiêu đề"} subtitle={`Lấy trang ngày ${dateLabel(d.retrievedAt)}`} />)}</List>
    : <EmptyState>Chưa có tài liệu nào được nhập từ nguồn này.</EmptyState>;
  return <>
    <DescriptionList items={[
      // canonicalSourceUrl() returns null for anything but http(s), so an unsafe stored URL is never a link.
      ["URL", url ? <ExternalLink key="u" href={url}>{url}</ExternalLink> : "URL nguồn cần được xác minh."],
      ["Mức độ nguồn (tier)", tierLabel(source.sourceTier)],
      ["Quốc gia", source.country ? <Link key="c" href={`/countries/${source.country.slug}`} className={textLink}>{countryName(source.country.slug, source.country.name)}</Link> : "Chưa gán quốc gia"],
      ["Loại / ngôn ngữ", `${source.sourceType ?? "Chưa rõ"} / ${source.language ?? "Chưa rõ"}`],
      ["Chủ đề", source.topics.length ? source.topics.join(", ") : "Chưa phân loại"],
      ["Xác minh gần nhất", dateLabel(source.lastVerifiedAt)],
      ...(internal ? [
        ["Lần crawl gần nhất", dateLabel(source.lastCrawledAt)],
        ["Crawl", `${source.crawlEnabled ? "Đang bật" : "Đang tắt"} · ${crawlPolicyLabels[source.crawlPolicy as keyof typeof crawlPolicyLabels] ?? source.crawlPolicy}`],
        ["Tần suất crawl", source.crawlFrequency ?? "Chưa lên lịch"],
        ["Căn cứ xác minh", source.authorityNotes ?? "Chưa kiểm tra"],
        ...(source.notes ? [["Ghi chú nội bộ", source.notes] as [string, string]] : []),
      ] as [string, React.ReactNode][] : []),
    ]} />
    <p className="mt-3 px-1 text-[13px] text-ink-3">Tier và việc xác minh mô tả nguồn, không chứng minh mọi câu nguồn đăng đều đúng.</p>
    {compact
      ? <div className="mt-8"><div className="mb-3 flex items-end justify-between gap-3 px-1"><h3 className="text-[17px] font-semibold text-ink">Tài liệu từ nguồn này</h3>{more}</div>{documents}</div>
      : <Section title="Tài liệu từ nguồn này" actions={more}>{documents}</Section>}
  </>;
}
