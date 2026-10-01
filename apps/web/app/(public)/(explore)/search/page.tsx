import Link from "next/link";
import Form from "next/form";
import { createPublicClient } from "@/lib/supabase/public";
import { logAccessError } from "@/lib/rbac/access";
import { searchParam } from "@/lib/pagination";
import { groupHits, hitHref, seeAllHref, type SearchHit } from "@/lib/search/domain";
import { EmptyState, List, ListRow, PageHeader, SearchInput, Section } from "@/components/ui";
import { buttonPrimary, textLink } from "@/components/ui/styles";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const q = searchParam(await searchParams);
  let groups: ReturnType<typeof groupHits> = [];
  if (q) {
    // Anonymous client: results are the public view even for signed-in editors.
    const { data, error } = await createPublicClient().rpc("search_public", { p_query: q, p_per_type: 5 });
    if (error) { logAccessError("public_search"); throw new Error("Không tìm kiếm được. Hãy thử lại."); }
    groups = groupHits((data ?? []) as SearchHit[]);
  }
  return <>
    <PageHeader eyebrow="Tìm kiếm" title="Tìm trong Nordic"
      description="Chỉ tìm trong thông tin đã duyệt và công khai: quốc gia, trường, chương trình, quy định nhập cư, nghề nghiệp, thông tin, nguồn và tài liệu." />
    <Form action="/search" className="mb-10 flex gap-3">
      <div className="flex-1"><SearchInput defaultValue={q} placeholder="Ví dụ: “Stockholm”, “work permit”, “malmo”…" /></div>
      <button className={buttonPrimary}>Tìm</button>
    </Form>
    {!q ? <EmptyState>Gõ một từ hoặc cụm từ. Không cần gõ dấu: “goteborg” vẫn tìm ra “Göteborg”. Đặt cụm từ trong ngoặc kép để tìm chính xác, thêm dấu trừ trước một từ để loại từ đó.</EmptyState>
      : !groups.length ? <EmptyState title={`Không có kết quả công khai cho “${q}”`}>Chưa có thông tin đã duyệt nào khớp. Mục chỉ xuất hiện ở đây sau khi được đối chiếu với nguồn; hệ thống không tự tạo nội dung để lấp chỗ trống.</EmptyState>
      : groups.map((g) => {
        const all = seeAllHref(g.type, q);
        return <Section key={g.type} title={<>{g.label} <span className="text-[15px] font-normal text-ink-3">{g.total}</span></>}
          actions={all && g.total > g.hits.length ? <Link href={all} className={`${textLink} text-[15px]`}>Xem tất cả</Link> : undefined}>
          <List label={g.label}>{g.hits.map((h) => {
            const href = hitHref(h);
            return <ListRow key={`${h.entity_type}-${h.id}`} href={href ?? undefined} title={h.title} subtitle={h.subtitle ?? undefined} />;
          })}</List>
        </Section>;
      })}
  </>;
}
