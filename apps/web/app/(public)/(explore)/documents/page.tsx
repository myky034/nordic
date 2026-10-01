import Link from "next/link";
import Form from "next/form";
import { connection } from "next/server";
import { searchDocuments } from "@/lib/documents/queries";
import { dateLabel } from "@/lib/registry/domain";
import { pageParam, pageSummary, searchParam, withParams } from "@/lib/pagination";
import { EmptyState, List, ListRow, PageHeader, Pagination, SearchInput } from "@/components/ui";
import { TierBadge } from "@/components/ui/badges";
import { buttonPrimary, textLink } from "@/components/ui/styles";

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  await connection();
  const query = await searchParams;
  const q = searchParam(query);
  const page = pageParam(query);
  const { rows, total } = await searchDocuments(q, page);
  return <>
    <PageHeader eyebrow="Bằng chứng" title="Tài liệu"
      description="Bản ghi các trang nguồn đã lưu: tiêu đề, URL, ngày lấy trang và trích đoạn ngắn. Lưu một tài liệu không có nghĩa nội dung của nó đã được kiểm chứng." />
    <Form action="/documents" className="mb-6 flex gap-3">
      <div className="flex-1"><SearchInput defaultValue={q} placeholder="Tiêu đề hoặc URL" /></div>
      <button className={buttonPrimary}>Tìm</button>
    </Form>
    {!rows.length
      ? (q ? <EmptyState>Không có tài liệu nào khớp “{q}”.</EmptyState>
        : <EmptyState title="Chưa có tài liệu nào" action={<Link href="/sources" className={`${textLink} text-[15px]`}>Xem danh sách nguồn</Link>}>
            Tài liệu sẽ xuất hiện khi có trang được nhập từ các nguồn đã đăng ký.
          </EmptyState>)
      : <List label="Tài liệu">{rows.map((document) => <ListRow key={document.id} href={`/documents/${document.id}`}
          title={document.title ?? "Tài liệu chưa có tiêu đề"}
          badges={<TierBadge tier={document.source.sourceTier} />}
          subtitle={`${document.source.name} · lấy trang ngày ${dateLabel(document.retrievedAt)}`} />)}</List>}
    <Pagination summary={pageSummary(total, page)} href={(p) => withParams("/documents", query, { page: p })} />
  </>;
}
